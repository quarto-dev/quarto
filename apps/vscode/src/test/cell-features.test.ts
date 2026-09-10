import * as vscode from "vscode";
import * as assert from "assert";

import {
  detectCellFeatureOwnership,
  hostOwnsLanguage,
  hostOwnsCellFeatures,
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
    await detectCellFeatureOwnership();

    assert.strictEqual(hostOwnsCellFeatures(), false);
    assert.strictEqual(hostOwnsCellFeatures(language("r")), false);
    assert.strictEqual(hostOwnsCellFeatures(language("python")), false);
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

  test("ignores a non-executable block that names a host owned language", async function () {
    // ```r is a display block, not a cell; the host has nothing to own in it.
    assert.strictEqual(await hostOwnsAnyCellIn("```r\nx <- 1\n```"), false);
  });
});
