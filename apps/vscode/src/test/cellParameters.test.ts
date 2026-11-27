import * as vscode from "vscode";
import * as assert from "assert";

import { ExtensionHost } from "../host";
import { CellExecutor } from "../host/executors";
import { MarkdownEngine } from "../markdown/engine";
import { cellCommands } from "../providers/cell/commands";
import {
  cellExecutorWithParameters,
  forgetAllLoadedParameters,
  frontMatterParametersLines,
  knitrParametersCode,
  parametersCell
} from "../providers/cell/parameters";

function qmd(frontMatter: string[], ...cells: string[][]): string {
  return ["---", ...frontMatter, "---", "", ...cells.flatMap((cell) => [...cell, ""])].join("\n");
}

const kParameters = ["```{python}", "#| tags: [parameters]", "alpha = 0.1", "ratio = 2", "```"];
const kUse = ["```{python}", "print(alpha)", "```"];
const kOther = ["```{python}", "y = 2", "```"];

suite("Finding the parameters cell", function () {
  async function parametersCode(content: string): Promise<string | undefined> {
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    return parametersCell(new MarkdownEngine().parse(doc))?.data;
  }

  test("finds the cell tagged parameters", async function () {
    assert.match(await parametersCode(qmd([], kUse, kParameters)) ?? "", /alpha = 0\.1/);
  });

  test("reads tags written as a string or among other tags", async function () {
    assert.ok(await parametersCode(qmd([], ["```{python}", "#| tags: parameters", "a = 1", "```"])));
    assert.ok(await parametersCode(qmd([], ["```{python}", "#| tags: [setup, parameters]", "a = 1", "```"])));
  });

  test("finds none without the tag", async function () {
    assert.strictEqual(await parametersCode(qmd([], kUse, ["```{python}", "#| tags: [setup]", "a = 1", "```"])), undefined);
  });
});

suite("Reading the params in a knitr document's front matter", function () {
  test("takes the params key and what is nested under it, as written", function () {
    assert.deepStrictEqual(
      frontMatterParametersLines([
        "title: Report",
        "params:",
        "  alpha: 0.1",
        "",
        "  # the day of the report",
        "  day: !expr Sys.Date()",
        "  region:",
        "    value: west",
        "",
        "# rendered with knitr",
        "engine: knitr"
      ].join("\n")),
      ["params:", "  alpha: 0.1", "", "  # the day of the report", "  day: !expr Sys.Date()", "  region:", "    value: west"]
    );
  });

  test("takes params written on one line, or last in the front matter", function () {
    assert.deepStrictEqual(frontMatterParametersLines("params: {alpha: 0.1}\nengine: knitr"), ["params: {alpha: 0.1}"]);
    assert.deepStrictEqual(frontMatterParametersLines("engine: knitr\nparams:\n  alpha: 0.1\n"), ["params:", "  alpha: 0.1"]);
  });

  test("finds none when there are no params, or they are empty", function () {
    assert.strictEqual(frontMatterParametersLines("title: Report\nengine: knitr"), undefined);
    assert.strictEqual(frontMatterParametersLines("params: # none yet\nengine: knitr"), undefined);
    assert.strictEqual(frontMatterParametersLines("format:\n  params: 1"), undefined);
  });

  test("hands the lines to knitr as R strings, when knitr is installed", function () {
    assert.strictEqual(
      knitrParametersCode(["params:", "  path: \"C:\\data\""]),
      "if (requireNamespace(\"knitr\", quietly = TRUE)) " +
      "params <- lapply(knitr::knit_params(c(\"---\", \"params:\", \"  path: \\\"C:\\\\data\\\"\", \"---\")), function(param) param$value)" +
      " else message(\"Install the knitr package to load this document's params.\")\n"
    );
  });
});

/**
 * Drives the real run commands against a fake host that records what it is
 * asked to run, one entry per call to the executor.
 */
suite("Running cells loads the parameters cell first", function () {
  // a new one for each test: the engine caches tokens by document uri and
  // version, which untitled documents opened one after another share
  let engine: MarkdownEngine;
  const kParametersCode = "alpha = 0.1\nratio = 2\n";

  interface Fake {
    host: ExtensionHost;
    ran: string[][];
    inline: number[][];
    /** `key` identifies the session; running code starts the `starts` one. */
    session: { key?: string; starts?: string; };
  }

  function fake(inline = false): Fake {
    const ran: string[][] = [];
    const inlineRan: number[][] = [];
    const session: Fake["session"] = {};
    const executor: CellExecutor = {
      execute: async (blocks: string[]) => {
        ran.push(blocks);
        session.key = session.starts ?? session.key;
      },
      ...(inline ? {
        executeInlineCells: async (_uri: vscode.Uri, ranges: vscode.Range[]) => {
          inlineRan.push(ranges.map((range) => range.start.line));
        }
      } : {})
    };
    const host = {
      executableLanguages: () => ["python", "r"],
      cellExecutorForLanguage: async () => executor,
      cellSessionKey: async () => session.key,
    } as unknown as ExtensionHost;
    return { host, ran, inline: inlineRan, session };
  }

  async function open(content: string): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    return vscode.window.showTextDocument(doc);
  }

  async function run(fakeHost: Fake, editor: vscode.TextEditor, commandId: string, line: number) {
    const command = cellCommands(fakeHost.host, engine).find((c) => c.id === commandId);
    assert.ok(command, `expected a ${commandId} command`);
    editor.selection = new vscode.Selection(line, 0, line, 0);
    await command!.execute();
  }

  function lineOf(editor: vscode.TextEditor, text: string): number {
    const line = editor.document.getText().split("\n").indexOf(text);
    assert.ok(line >= 0, `expected a line "${text}"`);
    return line;
  }

  setup(function () {
    engine = new MarkdownEngine();
    forgetAllLoadedParameters();
  });

  teardown(async function () {
    await vscode.workspace.getConfiguration("quarto").update("cells.autoLoadParameters", undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("runs the parameters before another cell, once", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse, kOther));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "y = 2"));
    assert.deepStrictEqual(host.ran, [[kParametersCode], ["print(alpha)\n"], ["y = 2\n"]]);
  });

  test("runs them again once the parameters cell is edited", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    const line = lineOf(editor, "alpha = 0.1");
    await editor.edit((edit) => edit.replace(new vscode.Range(line, 0, line, 11), "alpha = 0.5"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [
      [kParametersCode], ["print(alpha)\n"],
      ["alpha = 0.5\nratio = 2\n"], ["print(alpha)\n"]
    ]);
  });

  test("runs them again in a new session", async function () {
    const host = fake();
    host.session.key = "one";
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    host.session.key = "two";
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [
      [kParametersCode], ["print(alpha)\n"],
      ["print(alpha)\n"],
      [kParametersCode], ["print(alpha)\n"]
    ]);
  });

  test("running the parameters cell itself runs it once, and counts", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "alpha = 0.1"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [[kParametersCode], ["print(alpha)\n"]]);
  });

  test("an edited parameters cell that is run by hand is not run again", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    const line = lineOf(editor, "alpha = 0.1");
    await editor.edit((edit) => edit.replace(new vscode.Range(line, 0, line, 11), "alpha = 0.5"));
    await run(host, editor, "quarto.runCurrentCell", line);
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [
      [kParametersCode], ["print(alpha)\n"],
      ["alpha = 0.5\nratio = 2\n"],
      ["print(alpha)\n"]
    ]);
  });

  test("running the parameters cell in a session that it starts counts", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    const executor = await cellExecutorWithParameters(host.host, "python", editor.document, engine);
    // no session until something runs
    host.session.starts = "started";
    await executor!.execute([kParametersCode]);
    await executor!.execute(["print(alpha)\n"]);
    assert.deepStrictEqual(host.ran, [[kParametersCode], ["print(alpha)\n"]]);
  });

  test("runs them again in a session started after the first one is gone", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    // no session until something runs
    host.session.starts = "first";
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    // the session is shut down, and the next run starts another
    host.session.key = undefined;
    host.session.starts = "second";
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [
      [kParametersCode], ["print(alpha)\n"],
      ["print(alpha)\n"],
      [kParametersCode], ["print(alpha)\n"]
    ]);
  });

  test("Run All Cells does not run the parameters twice", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runAllCells", 0);
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [[kParametersCode, "print(alpha)\n"], ["print(alpha)\n"]]);
  });

  test("Run Cells Below from under the parameters cell runs it first", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse, kOther));
    await run(host, editor, "quarto.runCellsBelow", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [[kParametersCode], ["y = 2\n"]]);
  });

  test("with inline output, the parameters cell runs inline ahead of the cell, once", async function () {
    const host = fake(true);
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    const executor = await cellExecutorWithParameters(host.host, "python", editor.document, engine);
    const useLine = lineOf(editor, "print(alpha)");
    const useRange = new vscode.Range(useLine - 1, 0, useLine + 1, 3);
    await executor!.executeInlineCells!(editor.document.uri, [useRange]);
    await executor!.executeInlineCells!(editor.document.uri, [useRange]);
    const parametersLine = lineOf(editor, "#| tags: [parameters]") - 1;
    assert.deepStrictEqual(host.inline, [[parametersLine, useLine - 1], [useLine - 1]]);
    assert.deepStrictEqual(host.ran, []);
  });

  test("running a line of the parameters cell does not run the whole cell", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    const executor = await cellExecutorWithParameters(host.host, "python", editor.document, engine);
    await executor!.execute(["ratio = 2"]);
    assert.deepStrictEqual(host.ran, [["ratio = 2"]]);
  });

  test("leaves a knitr document alone", async function () {
    const host = fake();
    const editor = await open(qmd(["engine: knitr"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [["print(alpha)\n"]]);
  });

  const kKnitrFrontMatter = ["engine: knitr", "params:", "  alpha: 0.1"];
  const kKnitrParametersCode = knitrParametersCode(["params:", "  alpha: 0.1"]);
  const kUseR = ["```{r}", "print(params$alpha)", "```"];

  test("in a knitr document, defines params before an R cell, once", async function () {
    const host = fake();
    const editor = await open(qmd(kKnitrFrontMatter, kUseR, ["```{r}", "z <- 3", "```"]));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(params$alpha)"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "z <- 3"));
    assert.deepStrictEqual(host.ran, [[kKnitrParametersCode], ["print(params$alpha)\n"], ["z <- 3\n"]]);
  });

  test("in a knitr document, defines params again once they are edited", async function () {
    const host = fake();
    const editor = await open(qmd(kKnitrFrontMatter, kUseR));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(params$alpha)"));
    const line = lineOf(editor, "  alpha: 0.1");
    await editor.edit((edit) => edit.replace(new vscode.Range(line, 0, line, 12), "  alpha: 0.5"));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(params$alpha)"));
    assert.deepStrictEqual(host.ran, [
      [kKnitrParametersCode],
      ["print(params$alpha)\n"],
      [knitrParametersCode(["params:", "  alpha: 0.5"])],
      ["print(params$alpha)\n"]
    ]);
  });

  test("in a knitr document, defines params before a cell that only prints them", async function () {
    const host = fake();
    const editor = await open(qmd(kKnitrFrontMatter, ["```{r}", "params", "```"]));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "params"));
    assert.deepStrictEqual(host.ran, [[kKnitrParametersCode], ["params\n"]]);
  });

  test("in a knitr document, does not define params before a cell in another language", async function () {
    const host = fake();
    const editor = await open(qmd(kKnitrFrontMatter, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [["print(alpha)\n"]]);
  });

  test("in a knitr document with inline output, runs the cell alone", async function () {
    const host = fake(true);
    const editor = await open(qmd(kKnitrFrontMatter, kUseR));
    const executor = await cellExecutorWithParameters(host.host, "r", editor.document, engine);
    const useLine = lineOf(editor, "print(params$alpha)");
    await executor!.executeInlineCells!(editor.document.uri, [new vscode.Range(useLine - 1, 0, useLine + 1, 3)]);
    assert.deepStrictEqual(host.inline, [[useLine - 1]]);
    assert.deepStrictEqual(host.ran, []);
  });

  test("does not read front matter params in a Jupyter document", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: ir", "params:", "  alpha: 0.1"], kUseR));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(params$alpha)"));
    assert.deepStrictEqual(host.ran, [["print(params$alpha)\n"]]);
  });

  test("leaves a parameters cell with eval: false alone", async function () {
    const host = fake();
    const editor = await open(qmd(
      ["jupyter: python3"],
      ["```{python}", "#| tags: [parameters]", "#| eval: false", "alpha = 0.1", "```"],
      kUse
    ));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [["print(alpha)\n"]]);
  });

  test("does not run python parameters before a cell in another language", async function () {
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, ["```{r}", "z <- 3", "```"]));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "z <- 3"));
    assert.deepStrictEqual(host.ran, [["z <- 3\n"]]);
  });

  test("does nothing when the setting is off", async function () {
    await vscode.workspace.getConfiguration("quarto").update("cells.autoLoadParameters", false, vscode.ConfigurationTarget.Global);
    const host = fake();
    const editor = await open(qmd(["jupyter: python3"], kParameters, kUse));
    await run(host, editor, "quarto.runCurrentCell", lineOf(editor, "print(alpha)"));
    assert.deepStrictEqual(host.ran, [["print(alpha)\n"]]);

    const knitrEditor = await open(qmd(kKnitrFrontMatter, kUseR));
    await run(host, knitrEditor, "quarto.runCurrentCell", lineOf(knitrEditor, "print(params$alpha)"));
    assert.deepStrictEqual(host.ran, [["print(alpha)\n"], ["print(params$alpha)\n"]]);
  });
});
