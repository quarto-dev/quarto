/*
 * execute-cell.test.ts
 *
 * Positron-only integration test.
 *
 * Verifies the Quarto-specific behavior that runs on the way to the Positron
 * runtime API. In Positron the cell executor delegates to
 * `positron.runtime.executeCode` (`src/host/positron.ts`); this suite asserts
 * that Quarto does the right transformations before that call:
 *   - it strips Quarto cell options (`#| ...`) from the executed code, and
 *   - it reroutes knitr Python cells through `reticulate::repl_python(...)` and
 *     submits them to the *R* runtime.
 * Neither of these paths exists in vanilla VS Code, so they are uncovered by
 * the main suite.
 *
 * We stub Positron's API global with a spy and assert on the call the extension
 * makes, rather than depending on a live kernel actually starting (which hinges
 * on the host machine having a resolvable interpreter). The extension
 * re-acquires the API inside `execute()` via `tryAcquirePositronApi()`, which
 * reads `globalThis.acquirePositronApi` on every call, so a stub installed
 * after activation is observed by the run.
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as os from "os";
import { extension } from "../extension";
import { tryAcquirePositronApi } from "@posit-dev/positron";

interface RuntimeCall {
  method: "executeCode" | "executeInlineCell";
  args: unknown[];
}

suite("Positron: cell execution", function () {
  this.timeout(30000);

  // `acquirePositronApi` is injected onto the global by Positron; we swap it for
  // a spy during each test and must restore it afterwards.
  const globalWithApi = globalThis as { acquirePositronApi?: () => unknown; };
  let originalAcquire: (() => unknown) | undefined;

  teardown(function () {
    if (originalAcquire !== undefined) {
      globalWithApi.acquirePositronApi = originalAcquire;
      originalAcquire = undefined;
    }
  });

  /**
   * Activate Quarto, install a spy over the Positron runtime, open `qmd` as a
   * Quarto document, put the cursor on `codeLine`, run the current cell, and
   * return the runtime calls the extension made.
   */
  async function runCellAndCaptureCalls(
    qmd: string,
    codeLine: number
  ): Promise<RuntimeCall[]> {
    const positron = tryAcquirePositronApi();
    assert.ok(
      positron,
      "Positron API should be available when running under positron-test-electron"
    );

    // Activate with the real API present so Quarto selects the Positron host.
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }

    // Spy over the runtime: forward everything except the execution methods,
    // which we record instead of dispatching to a kernel.
    const calls: RuntimeCall[] = [];
    originalAcquire = globalWithApi.acquirePositronApi;
    const realApi = originalAcquire!() as { runtime: Record<string, unknown>; };
    const fakeRuntime = new Proxy(realApi.runtime, {
      get(target, prop, receiver) {
        if (prop === "executeCode") {
          return (...args: unknown[]) => {
            calls.push({ method: "executeCode", args });
            return Promise.resolve();
          };
        }
        if (prop === "executeInlineCell") {
          return (...args: unknown[]) => {
            calls.push({ method: "executeInlineCell", args });
            return Promise.resolve();
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const fakeApi = new Proxy(realApi, {
      get(target, prop, receiver) {
        if (prop === "runtime") {
          return fakeRuntime;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    globalWithApi.acquirePositronApi = () => fakeApi;

    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: qmd,
    });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(codeLine, 0, codeLine, 0);

    await vscode.commands.executeCommand("quarto.runCurrentCell");
    return calls;
  }

  test("submits a Python cell to executeCode as python, with cell options stripped", async function () {
    const marker = `qmd_marker_${Date.now()}`;
    const qmd = [
      "---",
      "title: test",
      "---",
      "",
      "```{python}",
      "#| echo: false",
      `${marker} = 42`,
      "```",
      "",
    ].join("\n");
    // Cursor on the statement (line 6), i.e. below the `#|` option line.
    const calls = await runCellAndCaptureCalls(qmd, 6);

    const call = calls.find(
      (c) => c.method === "executeCode" && c.args[0] === "python"
    );
    assert.ok(
      call,
      "Running the cell should call positron.runtime.executeCode('python', ...). " +
      `Observed: ${describe(calls)}`
    );

    const code = String(call!.args[1]);
    assert.ok(
      code.includes(`${marker} = 42`),
      "the cell's code should be forwarded to the runtime"
    );
    assert.ok(
      !code.includes("#|"),
      "Quarto cell options (`#| ...`) should be stripped before execution"
    );
  });

  test("reroutes a knitr Python cell through reticulate and submits it as r", async function () {
    const marker = `qmd_marker_${Date.now()}`;
    const qmd = [
      "---",
      "engine: knitr",
      "---",
      "",
      "```{python}",
      `${marker} = 42`,
      "```",
      "",
    ].join("\n");
    // Cursor on the statement (line 5).
    const calls = await runCellAndCaptureCalls(qmd, 5);

    // In a knitr document, Quarto sends Python to the R runtime wrapped in
    // reticulate rather than to the Python runtime directly.
    const call = calls.find(
      (c) => c.method === "executeCode" && c.args[0] === "r"
    );
    assert.ok(
      call,
      "A knitr Python cell should be submitted to executeCode('r', ...). " +
      `Observed: ${describe(calls)}`
    );

    const code = String(call!.args[1]);
    assert.ok(
      code.includes("reticulate::repl_python"),
      "knitr Python should be wrapped in reticulate::repl_python(...)"
    );
    assert.ok(
      code.includes(`${marker} = 42`),
      "the original Python code should be embedded in the reticulate call"
    );
  });

  test("submits a knitr Python cell as python when cells.useReticulate is false", async function () {
    const config = vscode.workspace.getConfiguration("quarto");
    const previous = config.get<boolean>("cells.useReticulate");
    await config.update(
      "cells.useReticulate",
      false,
      vscode.ConfigurationTarget.Global
    );
    try {
      const marker = `qmd_marker_${Date.now()}`;
      const qmd = [
        "---",
        "engine: knitr",
        "---",
        "",
        "```{python}",
        `${marker} = 42`,
        "```",
        "",
      ].join("\n");
      // Cursor on the statement (line 5).
      const calls = await runCellAndCaptureCalls(qmd, 5);

      const rCall = calls.find(
        (c) => c.method === "executeCode" && c.args[0] === "r"
      );
      assert.ok(
        !rCall,
        "With cells.useReticulate=false, a knitr Python cell should not be " +
        `submitted to the R runtime. Observed: ${describe(calls)}`
      );

      const pyCall = calls.find(
        (c) => c.method === "executeCode" && c.args[0] === "python"
      );
      assert.ok(
        pyCall,
        "With cells.useReticulate=false, a knitr Python cell should be " +
        `submitted to executeCode('python', ...). Observed: ${describe(calls)}`
      );
      assert.ok(
        !String(pyCall!.args[1]).includes("reticulate::repl_python"),
        "the code should not be wrapped in reticulate::repl_python(...)"
      );
    } finally {
      await config.update(
        "cells.useReticulate",
        previous,
        vscode.ConfigurationTarget.Global
      );
    }
  });

  test("submits a {sql} cell to ggsql when an extension provides a ggsql runtime", async function () {
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }

    // Needs the ggsql extension, which the test Positron may not have.
    const hasGgsql = vscode.extensions.all.some((ext) => {
      const runtimes = (ext.packageJSON as { contributes?: { languageRuntimes?: { languageId?: unknown }[] } })
        ?.contributes?.languageRuntimes;
      return Array.isArray(runtimes) && runtimes.some((r) => r?.languageId === "ggsql");
    });
    if (!hasGgsql) {
      this.skip();
    }

    const qmd = [
      "---",
      "title: test",
      "jupyter: python3",
      "---",
      "",
      "```{sql}",
      "--| label: q",
      "select 1 as x",
      "```",
      "",
    ].join("\n");

    const calls = await runCellAndCaptureCalls(qmd, 7);
    const call = calls.find((c) => c.method === "executeCode" && c.args[0] === "ggsql");
    assert.ok(
      call,
      "Running a {sql} cell should call positron.runtime.executeCode('ggsql', ...). " +
      `Observed: ${describe(calls)}`
    );
    assert.ok(String(call!.args[1]).includes("select 1 as x"));
    assert.ok(!String(call!.args[1]).includes("--|"), "cell options should be stripped");
  });
});

/**
 * {Rcpp} cells with inline output on, in a file-backed knitr document (inline
 * output needs a file). Positron builds with posit-dev/positron#17468 list
 * Rcpp through `_quartoHostedCellLanguages`; the test Positron may not, so the
 * command is stubbed where a test needs it.
 */
suite("Positron: {Rcpp} cells with inline output", function () {
  this.timeout(30000);

  const globalWithApi = globalThis as { acquirePositronApi?: () => unknown; };
  let originalAcquire: (() => unknown) | undefined;
  const disposables: vscode.Disposable[] = [];
  let previousInline: boolean | undefined;

  const kQmd = [
    "---",
    "engine: knitr",
    "---",
    "",
    "```{Rcpp}",
    "//| label: cpp",
    "// [[Rcpp::export]]",
    "int one() { return 1; }",
    "```",
    "",
    "```{r}",
    "one()",
    "```",
    "",
  ].join("\n");
  const kCppLine = 7;

  setup(async function () {
    const config = vscode.workspace.getConfiguration();
    previousInline = config.inspect<boolean>("quarto.inlineOutput.enabled")?.globalValue;
    await config.update("quarto.inlineOutput.enabled", true, vscode.ConfigurationTarget.Global);
  });

  teardown(async function () {
    disposables.splice(0).forEach((d) => d.dispose());
    if (originalAcquire !== undefined) {
      globalWithApi.acquirePositronApi = originalAcquire;
      originalAcquire = undefined;
    }
    await vscode.workspace.getConfiguration().update(
      "quarto.inlineOutput.enabled", previousInline, vscode.ConfigurationTarget.Global
    );
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  /** Runs `commandId` from `line` of a saved copy of the document, answering the runtime calls. */
  async function run(commandId: string, line: number): Promise<RuntimeCall[]> {
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }

    const calls: RuntimeCall[] = [];
    originalAcquire = globalWithApi.acquirePositronApi;
    const realApi = originalAcquire!() as { runtime: Record<string, unknown>; };
    const fakeRuntime = new Proxy(realApi.runtime, {
      get(target, prop, receiver) {
        if (prop === "executeCode" || prop === "executeInlineCell") {
          return (...args: unknown[]) => {
            calls.push({ method: prop, args });
            return Promise.resolve();
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    globalWithApi.acquirePositronApi = () => new Proxy(realApi, {
      get(target, prop, receiver) {
        return prop === "runtime" ? fakeRuntime : Reflect.get(target, prop, receiver);
      },
    });

    const dir = vscode.Uri.joinPath(vscode.Uri.file(os.tmpdir()), `quarto-rcpp-${Date.now()}`);
    const uri = vscode.Uri.joinPath(dir, "rcpp.qmd");
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(kQmd));
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(line, 0, line, 0);

    await vscode.commands.executeCommand(commandId);
    return calls;
  }

  async function positronListsHostedLanguages(): Promise<boolean> {
    return (await vscode.commands.getCommands(false)).includes("_quartoHostedCellLanguages");
  }

  /** Stands in for the command, unless this Positron has it. */
  async function stubHostedLanguages() {
    if (!(await positronListsHostedLanguages())) {
      disposables.push(vscode.commands.registerCommand("_quartoHostedCellLanguages", () => ["rcpp"]));
    }
  }

  /** Skips a test of Positron builds without the command. */
  async function skipIfPositronListsHostedLanguages(context: Mocha.Context) {
    if (await positronListsHostedLanguages()) {
      context.skip();
    }
  }

  test("Run Current on a line of an {Rcpp} cell runs the whole cell inline", async function () {
    await stubHostedLanguages();
    const calls = await run("quarto.runCurrent", kCppLine);
    const call = calls.find((c) => c.method === "executeInlineCell");
    assert.ok(call, `expected an inline run. Observed: ${describe(calls)}`);
    const ranges = call!.args[1] as vscode.Range[];
    assert.strictEqual(ranges.length, 1);
    assert.ok(ranges[0].start.line <= 5 && ranges[0].end.line >= 7, "the range should cover the cell");
  });

  test("Run All Cells runs the {Rcpp} and {r} cells inline together", async function () {
    await stubHostedLanguages();
    const calls = await run("quarto.runAllCells", 0);
    const call = calls.find((c) => c.method === "executeInlineCell");
    assert.ok(call, `expected an inline run. Observed: ${describe(calls)}`);
    assert.strictEqual((call!.args[1] as vscode.Range[]).length, 2);
  });

  test("without Positron support, an {Rcpp} cell compiles in the R console", async function () {
    await skipIfPositronListsHostedLanguages(this);
    const calls = await run("quarto.runCurrent", kCppLine);
    assert.ok(!calls.some((c) => c.method === "executeInlineCell"), `expected no inline run. Observed: ${describe(calls)}`);
    const call = calls.find((c) => c.method === "executeCode" && c.args[0] === "r");
    assert.ok(call, `expected executeCode('r', ...). Observed: ${describe(calls)}`);
    assert.ok(String(call!.args[1]).startsWith("Rcpp::sourceCpp(code = "));
    assert.ok(!String(call!.args[1]).includes("//|"), "cell options should be stripped");
  });

  test("without Positron support, Run All Cells compiles the {Rcpp} cell and runs the {r} cell in the R console", async function () {
    await skipIfPositronListsHostedLanguages(this);
    const calls = await run("quarto.runAllCells", 0);
    assert.ok(!calls.some((c) => c.method === "executeInlineCell"), `expected no inline run. Observed: ${describe(calls)}`);
    const code = calls.filter((c) => c.method === "executeCode" && c.args[0] === "r").map((c) => String(c.args[1]));
    assert.strictEqual(code.length, 2, `Observed: ${describe(calls)}`);
    assert.ok(code[0].startsWith("Rcpp::sourceCpp(code = "));
    assert.strictEqual(code[1].trim(), "one()");
  });
});

/** Compact summary of observed runtime calls for assertion messages. */
function describe(calls: RuntimeCall[]): string {
  return JSON.stringify(
    calls.map((c) => ({ method: c.method, language: c.args[0] }))
  );
}
