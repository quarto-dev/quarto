import * as vscode from "vscode";
import * as assert from "assert";

import { isExecutableLanguageBlock, TokenCodeBlock, TokenMath } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import {
  blockIsExecutable,
  codeWithoutOptions,
  codeWithoutOptionsFromBlock,
  documentExecutableLanguages,
} from "../providers/cell/executors";
import { ExtensionHost } from "../host";
import {
  contributedRuntimeLanguages,
  hostExplainUnrunnableCell,
  positronExtensionHost,
  positronRuntimeLanguage,
} from "../host/positron";
import {
  kHostExplainUnrunnableCellCommand,
  refreshHostCellLanguages,
} from "../host/cell-features";
import { cellOptions } from "../providers/cell/options";

suite("Code sent for execution", function () {
  const engine = new MarkdownEngine();

  /**
   * Parses `content` as an in-memory Quarto document and returns the code of
   * its single executable cell, as it would be sent to an executor (without
   * the trailing newline, which isn't what's under test here).
   */
  async function executedCode(content: string): Promise<string> {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content,
    });
    const blocks = engine.parse(doc).filter(isExecutableLanguageBlock);
    assert.strictEqual(blocks.length, 1, "expected exactly one executable cell");
    return codeWithoutOptionsFromBlock(blocks[0] as TokenMath | TokenCodeBlock).trimEnd();
  }

  test("strips *| options from a sas cell", async function () {
    assert.strictEqual(
      await executedCode("```{sas}\n*| label: a;\n*| echo: false;\nproc print data=sashelp.class; run;\n```"),
      "proc print data=sashelp.class; run;"
    );
  });

  test("strips #| options from a ggsql cell, as quarto-cli and the ggsql docs write them", async function () {
    // ggsql's options are `--|`, but quarto-cli reads `#|` for ggsql, and `#`
    // isn't a comment in ggsql, so these lines must not reach the console
    assert.strictEqual(
      await executedCode("```{ggsql}\n#| label: a\n#| error: true\nVISUALISE x, y FROM df DRAW point\n```"),
      "VISUALISE x, y FROM df DRAW point"
    );
  });

  test("reads ggsql cell options written with #| or --|", function () {
    assert.deepStrictEqual(cellOptions("ggsql", ["#| eval: false", "select 1"]), { eval: false });
    assert.deepStrictEqual(cellOptions("ggsql", ["--| eval: false", "select 1"]), { eval: false });
    // sql has no such alternative: a `#|` line there is code
    assert.deepStrictEqual(cellOptions("sql", ["#| eval: false", "select 1"]), {});
  });

  test("strips #| options from a Python cell", async function () {
    assert.strictEqual(
      await executedCode("```{python}\n#| label: a\n#| echo: false\nx = 1\n```"),
      "x = 1"
    );
  });

  test("strips #| options from a bash cell", async function () {
    assert.strictEqual(
      await executedCode("```{bash}\n#| label: a\necho hi\n```"),
      "echo hi"
    );
  });

  test("strips --| options from a ggsql cell, uncovering a -- @connect line", async function () {
    // the ggsql kernel only honors `-- @connect:` among a cell's leading lines
    assert.strictEqual(
      await executedCode("```{ggsql}\n--| label: plot\n--| echo: false\n-- @connect: duckdb://memory\nvisualise x from t draw point\n```"),
      "-- @connect: duckdb://memory\nvisualise x from t draw point"
    );
  });

  test("strips --| options from a sql cell, and only the leading ones", async function () {
    assert.strictEqual(
      await executedCode("```{sql}\n--|label: q\nselect 1\n--| not an option\n```"),
      "select 1\n--| not an option"
    );
  });

  test("keeps #| lines in a sql cell, whose options are written --|", async function () {
    assert.strictEqual(
      await executedCode("```{sql}\n#| label: q\nselect 1\n```"),
      "#| label: q\nselect 1"
    );
  });

  test("leaves a cell without options as it is", async function () {
    assert.strictEqual(await executedCode("```{sql}\nselect 1\n```"), "select 1");
    assert.strictEqual(await executedCode("```{python}\nx = 1\n```"), "x = 1");
  });

  test("sends nothing for a cell of only options", async function () {
    assert.strictEqual(await executedCode("```{python}\n#| label: a\n```"), "");
    assert.strictEqual(await executedCode("```{ggsql}\n--| label: a\n```"), "");
  });

  test("strips options from a visual editor block's code by its language", function () {
    // a visual editor block's code is the cell's body, options included
    assert.strictEqual(
      codeWithoutOptions("ggsql", "--| label: plot\n-- @connect: duckdb://memory\nselect 1"),
      "-- @connect: duckdb://memory\nselect 1"
    );
    assert.strictEqual(codeWithoutOptions("python", "#| echo: false\nx = 1"), "x = 1");
    assert.strictEqual(codeWithoutOptions("python", "x = 1"), "x = 1");
  });

  test("keeps #| lines in a language whose options use other comment characters", async function () {
    // stata has an executor, but its cell options are written as `*|`; a `#|`
    // line is code, not an option, so it is sent as is
    assert.strictEqual(
      await executedCode("```{stata}\n#| label: a\ndisplay 1\n```"),
      "#| label: a\ndisplay 1"
    );
  });
});

suite("Languages with a Positron runtime", function () {
  test("reads the languageRuntimes contributions of extensions", function () {
    const languages = contributedRuntimeLanguages([
      { packageJSON: { contributes: { languageRuntimes: [{ languageId: "sas" }] } } },
      { packageJSON: { contributes: { languageRuntimes: [{ languageId: "ggsql" }, { languageId: "sas" }] } } },
      { packageJSON: { contributes: { languages: [{ id: "markdown" }] } } },
      { packageJSON: {} },
      { packageJSON: undefined },
    ]);
    assert.deepStrictEqual([...languages].sort(), ["ggsql", "sas"]);
  });

  test("ignores malformed languageRuntimes contributions", function () {
    const languages = contributedRuntimeLanguages([
      { packageJSON: { contributes: { languageRuntimes: { languageId: "sas" } } } },
      { packageJSON: { contributes: { languageRuntimes: [null, {}, { languageId: 1 }, { languageId: "" }] } } },
    ]);
    assert.deepStrictEqual([...languages], []);
  });
});

suite("Cells the host runs", function () {
  const engine = new MarkdownEngine();

  /** Stands in for the languages that have a Positron runtime. */
  const runtimes = (...languages: string[]) => (language: string) => languages.includes(language);

  test("a {sql} cell runs in ggsql when ggsql has a runtime, except under knitr", function () {
    assert.strictEqual(positronRuntimeLanguage("sql", false, runtimes("ggsql")), "ggsql");
    // knitr renders {sql} cells with DBI, against another database
    assert.strictEqual(positronRuntimeLanguage("sql", true, runtimes("ggsql")), undefined);
    assert.strictEqual(positronRuntimeLanguage("sql", false, runtimes()), undefined);
  });

  test("a {sql} cell runs in a sql runtime of its own when ggsql doesn't run it", function () {
    assert.strictEqual(positronRuntimeLanguage("sql", true, runtimes("sql", "ggsql")), "sql");
    assert.strictEqual(positronRuntimeLanguage("sql", false, runtimes("sql")), "sql");
  });

  test("other cells run in a runtime of their own language, or Positron's own", function () {
    assert.strictEqual(positronRuntimeLanguage("ggsql", true, runtimes("ggsql")), "ggsql");
    assert.strictEqual(positronRuntimeLanguage("sas", false, runtimes("sas")), "sas");
    assert.strictEqual(positronRuntimeLanguage("python", false, runtimes()), "python");
    assert.strictEqual(positronRuntimeLanguage("mermaid", false, runtimes()), undefined);
    // bash has an executor in this extension, not a Positron runtime
    assert.strictEqual(positronRuntimeLanguage("bash", false, runtimes()), undefined);
  });

  test("the cells that can run are the host's executable languages for the document", async function () {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nx = 1\n```\n\n```{sql}\nselect 1\n```\n\n```{mermaid}\ngraph LR\n```",
    });
    const asked: boolean[] = [];
    const host = {
      executableLanguages: (visualMode: boolean, document: vscode.TextDocument) => {
        asked.push(visualMode);
        assert.strictEqual(document, doc);
        return ["python", "sql"];
      },
    } as unknown as ExtensionHost;
    const languages = documentExecutableLanguages(host, doc, engine);
    assert.deepStrictEqual([...languages].sort(), ["python", "sql"]);
    assert.deepStrictEqual(asked, [false]);
    const executable = engine.parse(doc).filter((t) => blockIsExecutable(languages, t));
    assert.strictEqual(executable.length, 2);
  });

  test("Positron runs no {sql} cell without a ggsql runtime", async function () {
    // no extension provides a ggsql runtime to the test host
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nx = 1\n```\n\n```{sql}\nselect 1\n```",
    });
    const host = positronExtensionHost();
    const languages = documentExecutableLanguages(host, doc, engine);
    assert.ok(languages.has("python") && !languages.has("sql"));
    // and falls back to this extension's own executors, which have none for sql
    assert.strictEqual(await host.cellExecutorForLanguage("sql", doc, engine, true), undefined);
    const executor = await host.cellExecutorForLanguage("python", doc, engine, true);
    assert.ok(executor?.executeInlineCells, "expected a Positron executor for python");
  });
});

suite("Cells the host explains it cannot run", function () {
  async function quartoDoc() {
    return await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "---\nengine: knitr\n---\n\n```{sql}\nselect 1\n```\n",
    });
  }

  /** Registers a stand in for Positron's explain command answering `answer`. */
  async function stubExplain(answer: () => unknown) {
    const calls: unknown[][] = [];
    const command = vscode.commands.registerCommand(
      kHostExplainUnrunnableCellCommand,
      (...args: unknown[]) => {
        calls.push(args);
        return answer();
      }
    );
    await refreshHostCellLanguages();
    return {
      calls,
      dispose: async () => {
        command.dispose();
        await refreshHostCellLanguages();
      },
    };
  }

  test("explains nothing when Positron has no such command", async function () {
    await refreshHostCellLanguages();
    const doc = await quartoDoc();
    assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    assert.strictEqual(await positronExtensionHost().explainNoExecutor!("sql", doc), false);
  });

  test("asks Positron to explain, and reports whether it did", async function () {
    const doc = await quartoDoc();
    let explained: unknown = true;
    const stub = await stubExplain(() => explained);
    try {
      assert.strictEqual(await positronExtensionHost().explainNoExecutor!("sql", doc), true);
      assert.strictEqual(String(stub.calls[0][0]), doc.uri.toString());
      assert.strictEqual(stub.calls[0][1], "sql");

      explained = false;
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
      explained = "yes";
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    } finally {
      await stub.dispose();
    }
  });

  test("sees a command registered after the host was last probed", async function () {
    await refreshHostCellLanguages();
    const doc = await quartoDoc();
    const command = vscode.commands.registerCommand(kHostExplainUnrunnableCellCommand, () => true);
    try {
      // no re-query in between: the probe is made when the explanation is needed
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), true);
    } finally {
      command.dispose();
    }
  });

  test("treats a failing command as no explanation", async function () {
    const doc = await quartoDoc();
    const stub = await stubExplain(() => { throw new Error("boom"); });
    try {
      assert.strictEqual(await hostExplainUnrunnableCell("sql", doc), false);
    } finally {
      await stub.dispose();
    }
  });
});
