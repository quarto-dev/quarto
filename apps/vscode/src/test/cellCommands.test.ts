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

  test("Run Current (Cmd+Enter) asks the host to explain a sql cell", async function () {
    const recorded = await run("quarto.runCurrent", kSqlLine);
    assert.deepStrictEqual(recorded.explained, ["sql"]);
    assert.deepStrictEqual(recorded.ran, []);
  });

  test("Run Cell and Advance asks the host to explain a sql cell", async function () {
    const recorded = await run("quarto.runCurrentAdvance", kSqlLine);
    assert.deepStrictEqual(recorded.explained, ["sql"]);
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
