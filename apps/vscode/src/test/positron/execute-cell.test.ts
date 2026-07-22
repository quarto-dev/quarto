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
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { extension } from "../extension";
import { tryAcquirePositronApi } from "@posit-dev/positron";
import { kInlineOutputEnabledSetting } from "../../host/positron";

const kDeprecatedInlineOutputEnabledSetting =
  "positron.quarto.inlineOutput.enabled";
const kExamplesOutDir = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "test",
  "examples-out"
);

interface RuntimeCall {
  method: "executeCode" | "executeInlineCell";
  args: unknown[];
}

suite("Positron: cell execution", function () {
  this.timeout(30000);

  // `acquirePositronApi` is injected onto the global by Positron; we swap it for
  // a spy during each test and must restore it afterwards.
  const globalWithApi = globalThis as { acquirePositronApi?: () => unknown };
  let originalAcquire: (() => unknown) | undefined;
  let originalGetConfiguration: typeof vscode.workspace.getConfiguration | undefined;
  const tempFiles: vscode.Uri[] = [];

  teardown(async function () {
    if (originalAcquire !== undefined) {
      globalWithApi.acquirePositronApi = originalAcquire;
      originalAcquire = undefined;
    }

    if (originalGetConfiguration !== undefined) {
      (vscode.workspace as typeof vscode.workspace & {
        getConfiguration: typeof vscode.workspace.getConfiguration;
      }).getConfiguration = originalGetConfiguration;
      originalGetConfiguration = undefined;
    }

    while (tempFiles.length > 0) {
      const tempFile = tempFiles.pop()!;
      await vscode.workspace.fs.delete(tempFile).then(
        () => undefined,
        () => undefined
      );
    }

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  /**
   * Activate Quarto, install a spy over the Positron runtime, open `qmd` as a
   * Quarto document, put the cursor on `codeLine`, run the current cell, and
   * return the runtime calls the extension made.
   */
  async function runCellAndCaptureCalls(
    qmd: string,
    codeLine: number,
    uri?: vscode.Uri
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
    const realApi = originalAcquire!() as { runtime: Record<string, unknown> };
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

    const doc = uri
      ? await openSavedQuartoDocument(uri, qmd)
      : await vscode.workspace.openTextDocument({
          language: "quarto",
          content: qmd,
        });
    const editor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(codeLine, 0, codeLine, 0);

    await vscode.commands.executeCommand("quarto.runCurrentCell");
    return calls;
  }

  async function openSavedQuartoDocument(
    uri: vscode.Uri,
    qmd: string
  ): Promise<vscode.TextDocument> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(kExamplesOutDir));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(qmd, "utf8"));
    tempFiles.push(uri);
    return await vscode.workspace.openTextDocument(uri);
  }

  function makeTempQuartoUri(prefix: string): vscode.Uri {
    return vscode.Uri.file(
      path.join(kExamplesOutDir, `${prefix}-${Date.now()}.qmd`)
    );
  }

  function mockInlineOutputEnabled(enabled: boolean): void {
    originalGetConfiguration ??= vscode.workspace.getConfiguration;
    (vscode.workspace as typeof vscode.workspace & {
      getConfiguration: typeof vscode.workspace.getConfiguration;
    }).getConfiguration = ((...args: Parameters<typeof vscode.workspace.getConfiguration>) => {
      const config = originalGetConfiguration!(...args);
      return {
        has: config.has.bind(config),
        update: config.update.bind(config),
        inspect: ((section: string) => {
          if (section === kInlineOutputEnabledSetting) {
            return { globalValue: enabled };
          }
          if (section === kDeprecatedInlineOutputEnabledSetting) {
            return { globalValue: undefined };
          }
          return config.inspect(section);
        }) as typeof config.inspect,
        get: ((section: string, defaultValue?: unknown) => {
          if (
            section === kInlineOutputEnabledSetting ||
            section === kDeprecatedInlineOutputEnabledSetting
          ) {
            return enabled;
          }
          return config.get(section, defaultValue);
        }) as typeof config.get,
      } as typeof config;
    }) as typeof vscode.workspace.getConfiguration;
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
    const calls = await runCellAndCaptureCalls(
      qmd,
      6,
      makeTempQuartoUri("positron-execute-code")
    );

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
    const calls = await runCellAndCaptureCalls(
      qmd,
      5,
      makeTempQuartoUri("positron-knitr-python")
    );

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

  test("uses executeInlineCell for a saved qmd when inline output is enabled", async function () {
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

    mockInlineOutputEnabled(true);

    const uri = makeTempQuartoUri("positron-inline");
    const calls = await runCellAndCaptureCalls(qmd, 6, uri);

    assert.ok(
      !calls.some((c) => c.method === "executeCode"),
      "Saved documents with inline output enabled should not fall back to executeCode"
    );

    const call = calls.find((c) => c.method === "executeInlineCell");
    assert.ok(
      call,
      "Running a saved document with inline output enabled should call positron.runtime.executeInlineCell(...). " +
        `Observed: ${describe(calls)}`
    );

    assert.ok(
      vscode.Uri.isUri(call!.args[0]) &&
        call!.args[0].toString() === uri.toString(),
      "executeInlineCell should receive the saved document URI"
    );

    const ranges = call!.args[1] as vscode.Range[];
    assert.ok(
      Array.isArray(ranges) && ranges.length === 1,
      "executeInlineCell should receive the current cell range"
    );

    const metadata = call!.args[2] as Record<string, unknown>[] | undefined;
    assert.strictEqual(
      metadata?.[0]?.echo,
      false,
      "executeInlineCell should receive parsed Quarto cell metadata"
    );
  });
});

/** Compact summary of observed runtime calls for assertion messages. */
function describe(calls: RuntimeCall[]): string {
  return JSON.stringify(
    calls.map((c) => ({ method: c.method, language: c.args[0] }))
  );
}
