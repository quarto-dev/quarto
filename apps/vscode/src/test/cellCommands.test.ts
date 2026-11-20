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
 * Drives the multi-cell run commands against a fake host that runs python
 * itself and sql only because the host says so (like Positron's ggsql runtime),
 * in a document whose first cell is sql.
 */
suite("Run commands on several cells, one of which the host alone runs", function () {
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
    "```{python}",
    "y = 2",
    "```",
    "",
    "```{sql}",
    "select 2",
    "```",
    "",
  ].join("\n");
  const kLastLine = 16;

  async function run(commandId: string, line: number): Promise<Record<string, string[]>> {
    const ran: Record<string, string[]> = {};
    const executorFor = (language: string): CellExecutor => ({
      execute: async (blocks: string[]) => { (ran[language] ??= []).push(...blocks); },
    });
    const host = {
      executableLanguages: () => ["python", "sql"],
      cellExecutorForLanguage: async (language: string) =>
        language === "python" || language === "sql" ? executorFor(language) : undefined,
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

  test("Run All Cells runs the python cells, not the sql cell that comes first", async function () {
    const ran = await run("quarto.runAllCells", 0);
    assert.deepStrictEqual(Object.keys(ran), ["python"]);
    assert.deepStrictEqual(ran.python.map((code) => code.trim()), ["x = 1", "y = 2"]);
  });

  test("Run Cells Below runs the python cells below", async function () {
    const ran = await run("quarto.runCellsBelow", 0);
    assert.deepStrictEqual(Object.keys(ran), ["python"]);
    assert.strictEqual(ran.python.length, 2);
  });

  test("Run Cells Above runs the python cells above, not the nearest sql cell", async function () {
    const ran = await run("quarto.runCellsAbove", kLastLine);
    assert.deepStrictEqual(Object.keys(ran), ["python"]);
    assert.strictEqual(ran.python.length, 2);
  });
});
