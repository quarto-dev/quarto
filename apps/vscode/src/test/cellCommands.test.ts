import * as vscode from "vscode";
import * as assert from "assert";

import { ExtensionHost } from "../host";
import { CellExecutor } from "../host/executors";
import { MarkdownEngine } from "../markdown/engine";
import { cellCommands } from "../providers/cell/commands";

/**
 * Drives the real run commands (`providers/cell/commands.ts`) against a fake
 * host that runs python and cannot run sql, recording what it is asked to run
 * and what it is asked to explain.
 */
suite("Run commands on a cell that cannot run", function () {
  const engine = new MarkdownEngine();

  const kQmd = [
    "---",
    "title: test",
    "---",
    "",
    "```{python}",
    "x = 1",
    "```",
    "",
    "```{sql}",
    "select 1",
    "```",
    "",
    "```{python}",
    "y = 2",
    "```",
    "",
  ].join("\n");
  const kFirstPythonLine = 5;
  const kSqlLine = 9;

  interface Recorded {
    ran: string[];
    explained: string[];
  }

  function fakeHost(explains: boolean, recorded: Recorded): ExtensionHost {
    const executor: CellExecutor = {
      execute: async (blocks: string[]) => { recorded.ran.push(...blocks); },
    };
    return {
      executableLanguages: () => ["python"],
      cellExecutorForLanguage: async (language: string) =>
        language === "python" ? executor : undefined,
      explainNoExecutor: async (language: string) => {
        recorded.explained.push(language);
        return explains;
      },
    } as unknown as ExtensionHost;
  }

  async function run(commandId: string, line: number, explains = true): Promise<Recorded> {
    const recorded: Recorded = { ran: [], explained: [] };
    const command = cellCommands(fakeHost(explains, recorded), engine)
      .find((c) => c.id === commandId);
    assert.ok(command, `expected a ${commandId} command`);

    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content: kQmd });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(line, 0, line, 0);

    await command!.execute();
    return recorded;
  }

  teardown(async function () {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("Run Cell asks the host to explain a sql cell", async function () {
    const recorded = await run("quarto.runCurrentCell", kSqlLine);
    assert.deepStrictEqual(recorded.explained, ["sql"]);
    assert.deepStrictEqual(recorded.ran, []);
  });

  test("a host with nothing to say leaves Run Cell silent", async function () {
    const recorded = await run("quarto.runCurrentCell", kSqlLine, false);
    assert.deepStrictEqual(recorded.explained, ["sql"]);
    assert.deepStrictEqual(recorded.ran, []);
  });

  test("Run Cell on a cell that runs does not ask", async function () {
    const recorded = await run("quarto.runCurrentCell", kFirstPythonLine);
    assert.deepStrictEqual(recorded.explained, []);
    assert.strictEqual(recorded.ran.length, 1);
    assert.ok(recorded.ran[0].includes("x = 1"));
  });

  test("Run Next Cell from a sql cell runs the next cell that runs, without asking", async function () {
    const recorded = await run("quarto.runNextCell", kSqlLine);
    assert.deepStrictEqual(recorded.explained, []);
    assert.strictEqual(recorded.ran.length, 1);
    assert.ok(recorded.ran[0].includes("y = 2"));
  });

  test("Run Previous Cell from a sql cell runs the previous cell that runs, without asking", async function () {
    const recorded = await run("quarto.runPreviousCell", kSqlLine);
    assert.deepStrictEqual(recorded.explained, []);
    assert.strictEqual(recorded.ran.length, 1);
    assert.ok(recorded.ran[0].includes("x = 1"));
  });
});

/**
 * Drives the multi-cell run commands against a fake host that runs python, and
 * sql and ggsql cells in one runtime (as Positron runs both in ggsql).
 */
suite("Run commands on several cells group them by runtime", function () {
  const engine = new MarkdownEngine();

  const kQmd = [
    "```{sql}",
    "--| label: q",
    "select 1",
    "```",
    "",
    "```{python}",
    "x = 1",
    "```",
    "",
    "```{ggsql}",
    "visualise x from t draw point",
    "```",
    "",
    "```{python}",
    "y = 2",
    "```",
    "",
  ].join("\n");
  const kAfterGgsql = 12;
  const kLastLine = 16;

  /** Runs `commandId` from `line`, answering which executor ran which code. */
  async function run(commandId: string, line: number, runtimes = true): Promise<Record<string, string[]>> {
    const ran: Record<string, string[]> = {};
    const executorFor = (language: string): CellExecutor => ({
      execute: async (blocks: string[]) => { (ran[language] ??= []).push(...blocks.map((b) => b.trim())); },
    });
    const host = {
      executableLanguages: () => ["python", "sql", "ggsql"],
      cellRuntimeLanguage: runtimes
        ? (language: string) => language === "sql" || language === "ggsql" ? "ggsql" : undefined
        : undefined,
      cellExecutorForLanguage: async (language: string) => executorFor(language),
    } as unknown as ExtensionHost;
    const command = cellCommands(host, engine).find((c) => c.id === commandId);
    assert.ok(command, `expected a ${commandId} command`);

    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content: kQmd });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(line, 0, line, 0);

    await command!.execute();
    return ran;
  }

  teardown(async function () {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("Run All Cells runs the cells that share the first cell's runtime", async function () {
    // the sql and ggsql cells, through the first one's executor; not python
    assert.deepStrictEqual(await run("quarto.runAllCells", 0), {
      sql: ["select 1", "visualise x from t draw point"],
    });
  });

  test("Run Cells Below runs the cells below that share the first one's runtime", async function () {
    assert.deepStrictEqual(await run("quarto.runCellsBelow", 4), { python: ["x = 1", "y = 2"] });
  });

  test("Run Cells Above runs the cells above that share the nearest one's runtime", async function () {
    assert.deepStrictEqual(await run("quarto.runCellsAbove", kLastLine), { python: ["x = 1", "y = 2"] });
    assert.deepStrictEqual(await run("quarto.runCellsAbove", kAfterGgsql), {
      ggsql: ["select 1", "visualise x from t draw point"],
    });
  });

  test("without runtimes from the host, each cell language runs on its own", async function () {
    assert.deepStrictEqual(await run("quarto.runAllCells", 0, false), { sql: ["select 1"] });
  });
});

/**
 * Drives the run commands against a fake host that runs {Rcpp} cells in R, as
 * Positron does: they share the r runtime, and an {Rcpp} cell runs in R as a
 * `sourceCpp()` call.
 */
suite("Run commands on {Rcpp} cells", function () {
  const kQmd = [
    "```{Rcpp}",
    "//| label: cpp",
    "int one() { return 1; }",
    "```",
    "",
    "```{r}",
    "one()",
    "```",
    "",
  ].join("\n");
  const kCppLine = 2;
  const kLastLine = 8;

  const wrap = (code: string) => `sourceCpp(${code.trim()})`;

  /** Runs `commandId` from `line` in `qmd`, answering which executor ran which code. */
  async function run(commandId: string, line: number, qmd = kQmd): Promise<Record<string, string[]>> {
    const ran: Record<string, string[]> = {};
    const executorFor = (language: string): CellExecutor => ({
      // like Positron's, the Rcpp executor runs its cells as sourceCpp() calls
      execute: async (blocks: string[]) => {
        (ran[language] ??= []).push(...blocks.map((b) => language === "Rcpp" ? wrap(b) : b.trim()));
      },
      runsWholeCell: language === "Rcpp" || undefined,
    });
    const host = {
      executableLanguages: () => ["r", "Rcpp"],
      cellRuntimeLanguage: (language: string) => language === "Rcpp" ? "r" : language,
      cellCodeForRuntime: (language: string, code: string) => language === "Rcpp" ? wrap(code) : code,
      cellExecutorForLanguage: async (language: string) => executorFor(language),
    } as unknown as ExtensionHost;
    // a new engine each run: the parser caches by document URI and version,
    // and untitled documents reuse their URIs
    const command = cellCommands(host, new MarkdownEngine()).find((c) => c.id === commandId);
    assert.ok(command, `expected a ${commandId} command`);

    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content: qmd });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(line, 0, line, 0);

    await command!.execute();
    return ran;
  }

  teardown(async function () {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("Run All Cells runs {Rcpp} and {r} cells together, in R", async function () {
    assert.deepStrictEqual(await run("quarto.runAllCells", 0), {
      r: ["sourceCpp(int one() { return 1; })", "one()"],
    });
  });

  test("Run Cells Above runs {Rcpp} cells above an {r} cell in R", async function () {
    assert.deepStrictEqual(await run("quarto.runCellsAbove", kLastLine), {
      r: ["sourceCpp(int one() { return 1; })", "one()"],
    });
  });

  test("Run All Cells in a document of only {Rcpp} cells runs them through their own executor", async function () {
    const qmd = "```{Rcpp}\nint one() { return 1; }\n```\n\n```{Rcpp}\nint two() { return 2; }\n```\n";
    assert.deepStrictEqual(await run("quarto.runAllCells", 0, qmd), {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Rcpp: ["sourceCpp(int one() { return 1; })", "sourceCpp(int two() { return 2; })"],
    });
  });

  test("Run Current on a line of an {Rcpp} cell runs the whole cell, without its options", async function () {
    assert.deepStrictEqual(await run("quarto.runCurrent", kCppLine), {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Rcpp: ["sourceCpp(int one() { return 1; })"],
    });
  });
});
