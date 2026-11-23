import * as vscode from "vscode";
import * as assert from "assert";

import {
  detectCellFeatureOwnership,
  hostOwnsLanguage,
  hostOwnsCellFeatures,
  kHostOwnedLanguagesCommand,
  onDidChangeHostOwnedLanguages,
  refreshHostCellLanguages,
} from "../host/cell-features";
import { hostOwnsAnyCell } from "../providers/semantic-tokens";
import { embeddedLanguage } from "../vdoc/languages";
import { MarkdownEngine } from "../markdown/engine";

function language(name: string) {
  const found = embeddedLanguage(name);
  assert.ok(found, `Expected ${name} to be an embedded language`);
  return found;
}

suite("Cell Feature Ownership", function () {
  test("recognizes the languages the host owns", function () {
    assert.strictEqual(hostOwnsLanguage(language("r")), true);
    assert.strictEqual(hostOwnsLanguage(language("python")), true);
  });

  test("does not recognize languages that keep their virtual document", function () {
    assert.strictEqual(hostOwnsLanguage(language("julia")), false);
    assert.strictEqual(hostOwnsLanguage(language("typescript")), false);
    assert.strictEqual(hostOwnsLanguage(language("sql")), false);
  });

  test("matches every alias of a host owned language", function () {
    // `embeddedLanguage` strips a leading engine prefix, so a `{r}` chunk and an
    // `{ojs-r}` one resolve to the same language object; the gate matches on the
    // language's own `ids` rather than on the chunk's text.
    assert.deepStrictEqual(language("r").ids, ["r"]);
    assert.deepStrictEqual(language("python").ids, ["python"]);
  });

  test("a probe can only see the internal command ids, not the public ones", async function () {
    const filtered = await vscode.commands.getCommands(true);
    const unfiltered = await vscode.commands.getCommands(false);

    assert.strictEqual(
      unfiltered.includes("vscode.executeDocumentSymbolProvider"),
      false,
      "API commands are not expected to be visible to getCommands"
    );
    assert.strictEqual(
      unfiltered.includes("_executeDocumentSymbolProvider"),
      true,
      "the internal command is expected to be visible when nothing is filtered"
    );
    assert.strictEqual(
      filtered.includes("_executeDocumentSymbolProvider"),
      false,
      "getCommands(true) is expected to filter underscore-prefixed ids"
    );
  });

  test("stays off when the host has no cell commands", async function () {
    // Vanilla VS Code, which is what these tests run in: the Positron commands
    // are absent, so the gate is off no matter what the setting says.
    const listeners = await detectCellFeatureOwnership();
    listeners.dispose();

    assert.strictEqual(hostOwnsCellFeatures(), false);
    assert.strictEqual(hostOwnsCellFeatures(language("r")), false);
    assert.strictEqual(hostOwnsCellFeatures(language("python")), false);
  });
});

suite("Host Advertised Cell Languages", function () {
  /**
   * Registers a stand in for the host's command that answers `answer`, runs
   * `body`, then unregisters it and restores the cached set.
   */
  async function withHostOwnedLanguages(
    answer: () => unknown,
    body: () => Promise<void>
  ): Promise<void> {
    const command = vscode.commands.registerCommand(kHostOwnedLanguagesCommand, answer);
    try {
      await refreshHostCellLanguages();
      await body();
    } finally {
      command.dispose();
      await refreshHostCellLanguages();
    }
  }

  test("uses the languages the host advertises", async function () {
    await withHostOwnedLanguages(() => ["r", "python", "SQL", "ggsql"], async () => {
      assert.strictEqual(hostOwnsLanguage(language("r")), true);
      assert.strictEqual(hostOwnsLanguage(language("python")), true);
      assert.strictEqual(hostOwnsLanguage(language("sql")), true);
      assert.strictEqual(hostOwnsLanguage(language("julia")), false);
    });
  });

  test("owns nothing when the host advertises nothing", async function () {
    await withHostOwnedLanguages(() => [], async () => {
      assert.strictEqual(hostOwnsLanguage(language("r")), false);
      assert.strictEqual(hostOwnsLanguage(language("python")), false);
    });
  });

  test("falls back to r and python when the host has no such command", async function () {
    await refreshHostCellLanguages();
    assert.strictEqual(hostOwnsLanguage(language("r")), true);
    assert.strictEqual(hostOwnsLanguage(language("python")), true);
    assert.strictEqual(hostOwnsLanguage(language("sql")), false);
  });

  test("falls back to r and python when the command fails or answers nonsense", async function () {
    await withHostOwnedLanguages(() => { throw new Error("boom"); }, async () => {
      assert.strictEqual(hostOwnsLanguage(language("r")), true);
      assert.strictEqual(hostOwnsLanguage(language("sql")), false);
    });
    await withHostOwnedLanguages(() => "sql", async () => {
      assert.strictEqual(hostOwnsLanguage(language("r")), true);
      assert.strictEqual(hostOwnsLanguage(language("sql")), false);
    });
  });

  test("announces a change in the advertised languages", async function () {
    let changes = 0;
    const listener = onDidChangeHostOwnedLanguages(() => changes++);
    try {
      await withHostOwnedLanguages(() => ["sql"], async () => {
        assert.strictEqual(changes, 1);
        // asking again with the same answer is not a change
        await refreshHostCellLanguages();
        assert.strictEqual(changes, 1);
      });
      // and back to the fallback when the command goes away
      assert.strictEqual(changes, 2);
    } finally {
      listener.dispose();
    }
  });

  test("still stays off without the cell commands", async function () {
    // the advertised set decides which languages, never whether: that still
    // takes the cell commands and the setting
    await withHostOwnedLanguages(() => ["sql"], async () => {
      assert.strictEqual(hostOwnsCellFeatures(), false);
      assert.strictEqual(hostOwnsCellFeatures(language("sql")), false);
    });
  });
});

suite("Host Owned Cells In A Document", function () {
  const engine = new MarkdownEngine();

  /**
   * Parses `content` as a Quarto document and asks whether any of its cells are
   * in a language the host owns.
   *
   * The document is in memory and never shown. A fixture on disk would be worse
   * here: showing one wakes the providers, which litter the workspace folder
   * with `.vdoc.*` temp files that other suites then trip over while copying it.
   */
  async function hostOwnsAnyCellIn(content: string): Promise<boolean> {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content,
    });
    return hostOwnsAnyCell(engine.parse(doc));
  }

  const kJulia = "```{julia}\nx = 1\n```";
  const kPython = "```{python}\nx = 1\n```";
  const kR = "```{r}\nx <- 1\n```";
  const kTypescript = "```{typescript}\nconst x = 1;\n```";

  test("sees an R cell", async function () {
    assert.strictEqual(await hostOwnsAnyCellIn(kR), true);
  });

  test("sees a Python cell", async function () {
    assert.strictEqual(await hostOwnsAnyCellIn(kPython), true);
  });

  test("sees one host owned cell among cells of another language", async function () {
    // One host owned cell is enough. Semantic tokens are answered for the whole
    // document and only one provider's answer survives, so the host takes the
    // document as soon as it owns any of it.
    assert.strictEqual(
      await hostOwnsAnyCellIn(`${kJulia}\n\n${kPython}`),
      true
    );
  });

  test("sees no host owned cells among only julia and typescript", async function () {
    assert.strictEqual(
      await hostOwnsAnyCellIn(`${kJulia}\n\n${kTypescript}`),
      false
    );
  });

  test("sees no host owned cells in a document with no code", async function () {
    assert.strictEqual(
      await hostOwnsAnyCellIn("# Heading\n\nJust prose, no cells.\n"),
      false
    );
  });

  test("follows the languages the host advertises", async function () {
    const kSql = "```{sql}\nselect 1\n```";
    assert.strictEqual(await hostOwnsAnyCellIn(kSql), false);

    const command = vscode.commands.registerCommand(
      kHostOwnedLanguagesCommand,
      () => ["r", "python", "sql"]
    );
    try {
      await refreshHostCellLanguages();
      assert.strictEqual(await hostOwnsAnyCellIn(kSql), true);
      assert.strictEqual(await hostOwnsAnyCellIn(`${kJulia}\n\n${kSql}`), true);
    } finally {
      command.dispose();
      await refreshHostCellLanguages();
    }
  });

  test("ignores a non-executable block that names a host owned language", async function () {
    // ```r is a display block, not a cell; the host has nothing to own in it.
    assert.strictEqual(await hostOwnsAnyCellIn("```r\nx <- 1\n```"), false);
  });
});
