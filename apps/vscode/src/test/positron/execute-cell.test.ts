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
   * Quarto document, put the cursor on `codeLine`, run the current cell (or
   * `command`), and return the runtime calls the extension made.
   */
  async function runCellAndCaptureCalls(
    qmd: string,
    codeLine: number,
    command = "quarto.runCurrentCell"
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
    // keep the real one when this runs more than once in a test
    originalAcquire ??= globalWithApi.acquirePositronApi;
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

    await vscode.commands.executeCommand(command);
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

  test("submits a cell Positron says it runs to that runtime", async function () {
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }

    // A Positron that has the command answers from its own runtimes, which
    // this test cannot control; stand in for it in one that does not.
    const kCommand = "_quartoHostCellRuntimeLanguages";
    const all = await vscode.commands.getCommands(false);
    if (all.includes(kCommand)) {
      this.skip();
    }

    // Registered after the extension activated, with nothing to make it
    // re-query the host: the command is called, not probed for up front.
    const stub = vscode.commands.registerCommand(
      kCommand,
      (_uri: vscode.Uri, languages: string[]) =>
        Object.fromEntries(languages.filter((l) => l === "ggsql").map((l) => [l, "ggsql"]))
    );
    try {
      const qmd = [
        "---",
        "title: test",
        "---",
        "",
        "```{ggsql}",
        "--| label: plot",
        "visualise x, y from t draw point",
        "```",
        "",
      ].join("\n");

      const calls = await runCellAndCaptureCalls(qmd, 6);
      const call = calls.find((c) => c.method === "executeCode" && c.args[0] === "ggsql");
      assert.ok(
        call,
        "Running a {ggsql} cell should call positron.runtime.executeCode('ggsql', ...). " +
        `Observed: ${describe(calls)}`
      );
      assert.ok(String(call!.args[1]).includes("visualise x, y from t draw point"));
      assert.ok(!String(call!.args[1]).includes("--|"), "cell options should be stripped");
    } finally {
      stub.dispose();
    }
  });

  for (const command of ["quarto.runCurrentCell", "quarto.runCurrent"]) {
    test(`${command} asks Positron to explain a sql cell it cannot run`, async function () {
      const quarto = extension();
      if (!quarto.isActive) {
        await quarto.activate();
      }

      // A Positron that has the command explains for real (with a
      // notification); stand in for it, so the test neither depends on nor
      // shows one.
      const kCommand = "_quartoHostExplainUnrunnableCell";
      const all = await vscode.commands.getCommands(false);
      if (all.includes(kCommand)) {
        this.skip();
      }

      // Registered after the extension activated and probed the host, with
      // nothing to make it probe again: the explanation must still be asked.
      const explained: unknown[][] = [];
      const stub = vscode.commands.registerCommand(kCommand, (...args: unknown[]) => {
        explained.push(args);
        return true;
      });
      try {
        // no ggsql runtime in the test build, so nothing runs this sql cell
        const qmd = [
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
        ].join("\n");
        const calls = await runCellAndCaptureCalls(qmd, 9, command);

        assert.strictEqual(explained.length, 1, "Running a sql cell nothing runs should ask Positron to explain");
        assert.ok(explained[0][0] instanceof vscode.Uri);
        assert.strictEqual(explained[0][1], "sql");
        assert.deepStrictEqual(calls, [], `Nothing should run. Observed: ${describe(calls)}`);
      } finally {
        stub.dispose();
      }
    });
  }

  test("quarto.runNextCell from a sql cell runs the next python cell, without asking", async function () {
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }
    const kCommand = "_quartoHostExplainUnrunnableCell";
    const all = await vscode.commands.getCommands(false);
    const explained: unknown[][] = [];
    const stub = all.includes(kCommand)
      ? undefined
      : vscode.commands.registerCommand(kCommand, (...args: unknown[]) => {
        explained.push(args);
        return true;
      });
    try {
      const marker = `qmd_marker_${Date.now()}`;
      const qmd = [
        "---",
        "title: test",
        "---",
        "",
        "```{sql}",
        "select 1",
        "```",
        "",
        "```{python}",
        `${marker} = 42`,
        "```",
        "",
      ].join("\n");
      const calls = await runCellAndCaptureCalls(qmd, 5, "quarto.runNextCell");

      assert.deepStrictEqual(explained, []);
      const call = calls.find((c) => c.method === "executeCode" && c.args[0] === "python");
      assert.ok(call, `The next python cell should run. Observed: ${describe(calls)}`);
      assert.ok(String(call!.args[1]).includes(`${marker} = 42`));
    } finally {
      stub?.dispose();
    }
  });
});

/** Compact summary of observed runtime calls for assertion messages. */
function describe(calls: RuntimeCall[]): string {
  return JSON.stringify(
    calls.map((c) => ({ method: c.method, language: c.args[0] }))
  );
}
