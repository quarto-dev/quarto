import * as assert from "assert";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { examplesOutUri, openAndShowUri, wait } from "./test-utils";
import { testLanguageClient } from "./test-language-client";
import { VIRTUAL_DOC_TEMP_DIRECTORY } from "./../vdoc/vdoc-tempfile";

suite("Diagnostics", function () {
  const exampleUri = examplesOutUri("diagnostics.qmd");
  const diagnosticsSettledEvent = debounceEvent(onDidReceiveTestDiagnosticsForDocument(exampleUri), 100);

  let client: LanguageClient;
  let disposables: vscode.Disposable[];

  suiteSetup(async function () {
    client = testLanguageClient();
    await client.start();
    disposables = [];
  });

  suiteTeardown(async function () {
    await client.stop();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    disposables.forEach((d) => d.dispose());
  });

  teardown(async function () {
    await assertNoLocalVirtualDocs();
    await assertNoTempFileVirtualDocs();
  });

  test("maps diagnostics from virtual doc back to the .qmd", async function () {
    // Create an event that fires when test diagnostics are received for the document.
    const promise = eventToPromise(diagnosticsSettledEvent);

    // Open the document - the language server should respond with diagnostics.
    await openAndShowUri(exampleUri);

    // Wait for diagnostics to settle.
    const diagnostics = await promise;
    assert.ok(
      diagnostics.length > 0,
      "Expected at least one diagnostic on the .qmd file"
    );
    const diag = diagnostics.find((d) =>
      d.message.includes("test-diagnostic")
    )!;
    assert.strictEqual(
      diag.range.start.line,
      8,
      `Diagnostic should be on line 8, got line ${diag.range.start.line}`
    );
  });

  test("updates diagnostics when document is edited", async function () {
    // Create an event that fires when test diagnostics are received for the document.
    let promise = eventToPromise(diagnosticsSettledEvent);

    // Open the document - the language server should respond with diagnostics.
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: '```{python}\nprint("Hello")\n```',
    });

    // TODO: Could also just edit the file
    // Ignore initial diagnostics.
    console.log('Waiting for initial diagnostics...');
    let diagnostics = await promise;
    assert.ok(diagnostics.length > 0, "Expected no initial diagnostics");

    // Edit: add a second code cell with undefined_var
    promise = eventToPromise(diagnosticsSettledEvent);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((editBuilder) => {
      const lastLine = doc.lineCount;
      editBuilder.insert(
        new vscode.Position(lastLine, 0),
        "\n```{python}\nundefined_var\n```\n"
      );
    });

    // Wait for debounce + new diagnostics
    console.log('Waiting for updated diagnostics...');
    diagnostics = await promise;
    const testDiags = diagnostics.filter((d) =>
      d.message.includes("test-diagnostic")
    );
    assert.strictEqual(
      testDiags.length,
      2,
      `Expected two diagnostics after adding a second cell, got ${testDiags.length}`
    );
  });

  test("clears diagnostics when document is closed", async function () {
    const promise = eventToPromise(diagnosticsSettledEvent);

    // Close the document - the language server should clear diagnostics for the document.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // Wait for diagnostics to be cleared.
    const diagnostics = await promise;
    assert.strictEqual(
      diagnostics.length,
      0,
      "Diagnostics should be cleared after closing the document"
    );
  });
});

function onDidReceiveDiagnosticsForDocument(
  uri: vscode.Uri,
): vscode.Event<vscode.Diagnostic[]> {
  return (listener, thisArgs?, disposables?) => {
    return vscode.languages.onDidChangeDiagnostics((e) => {
      for (const diagnosticsUri of e.uris) {
        if (diagnosticsUri.toString() === uri.toString()) {
          const diagnostics = vscode.languages.getDiagnostics(diagnosticsUri);
          listener.call(thisArgs, diagnostics);
        }
      }
    }, thisArgs, disposables);
  };
}

function onDidReceiveTestDiagnosticsForDocument(uri: vscode.Uri): vscode.Event<vscode.Diagnostic[]> {
  return (listener, thisArgs?, disposables?) => {
    // TODO: Challenge: we dont know when this was our embedded diagnostics or something else...
    return onDidReceiveDiagnosticsForDocument(uri)(diagnostics => {
      if (diagnostics.some(isTestDiagnostic)) {
        console.log(`Received ${diagnostics.length} diagnostics for ${uri.toString()}`);
        diagnostics.forEach((d) => {
          console.log(`- ${d.message} at [${d.range.start.line}, ${d.range.start.character}]`);
        });
        listener.call(thisArgs, diagnostics);
      }
    }, thisArgs, disposables);
  };
}

function isTestDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  return /^test-diagnostic:/.test(diagnostic.message);
}

export function onceEvent<T>(event: vscode.Event<T>): vscode.Event<T> {
  return (listener: (e: T) => any, thisArgs?: any, disposables?: vscode.Disposable[]) => {
    const result = event(e => {
      result.dispose();
      return listener.call(thisArgs, e);
    }, null, disposables);

    return result;
  };
}

export function debounceEvent<T>(event: vscode.Event<T>, delay: number): vscode.Event<T> {
  return (listener: (e: T) => any, thisArgs?: any, disposables?: vscode.Disposable[]) => {
    let timer: NodeJS.Timeout;
    return event(e => {
      clearTimeout(timer);
      timer = setTimeout(() => listener.call(thisArgs, e), delay);
    }, null, disposables);
  };
}

export function eventToPromise<T>(event: vscode.Event<T>): Promise<T> {
  return new Promise<T>(c => onceEvent(event)(c));
}

// async function eventToPromise<T>(
//   event: vscode.Event<T>,
//   disposables: vscode.Disposable[],
// ) {
//   return new Promise<T>((resolve) => {
//     const disposable = event((e) => {
//       disposable.dispose();
//       resolve(e);
//     }, null, disposables);
//   });
// }

// function filterEvent<T>(
//   event: vscode.Event<T>,
//   filter: (e: T) => boolean,
//   disposables: vscode.Disposable[],
// ): vscode.Event<T> {
//   return (listener, thisArgs?, disposables?) => {
//     return event((e) => {
//       if (filter(e)) {
//         listener.call(thisArgs, e);
//       }
//     }, null, disposables);
//   };
// }

// async function waitForDiagnostics(
//   uri: vscode.Uri,
//   predicate: (d: vscode.Diagnostic) => boolean,
//   timeoutMs: number
// ): Promise<vscode.Diagnostic[]> {
//   const start = Date.now();

//   while (Date.now() - start < timeoutMs) {
//     const diagnostics = vscode.languages.getDiagnostics(uri);
//     if (diagnostics.some(predicate)) {
//       return diagnostics;
//     }
//     await wait(200);
//   }

//   return vscode.languages.getDiagnostics(uri);
// }

// async function waitForDiagnosticsCleared(
//   uri: vscode.Uri,
//   timeoutMs: number
// ): Promise<vscode.Diagnostic[]> {
//   const start = Date.now();

//   while (Date.now() - start < timeoutMs) {
//     const diagnostics = vscode.languages.getDiagnostics(uri);
//     if (diagnostics.length === 0) {
//       return diagnostics;
//     }
//     await wait(200);
//   }

//   return vscode.languages.getDiagnostics(uri);
// }

// async function poll(
//   assertion: () => Promise<void>,
//   message: string,
//   timeoutMs: number
// ): Promise<void> {
//   const start = Date.now();

//   let finalError: unknown | null = null;
//   while (Date.now() - start < timeoutMs) {
//     try {
//       return await assertion();
//     } catch (error) {
//       console.error(`${message}: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
//       finalError = error;
//       // Ignore and retry until timeout
//     }
//     await wait(200);
//   }

//   if (finalError) {
//     throw finalError;
//   }
// }

/**
 * Check that there are no virtual doc files lingering in the workspace.
 */
async function assertNoLocalVirtualDocs() {
  const vdocFiles = await vscode.workspace.findFiles("**/.vdoc.*");
  assert.strictEqual(
    vdocFiles.length,
    0,
    `Expected no virtual doc files, but found ${vdocFiles.length}`
  );
}

/**
 * Check that there are no virtual doc files lingering in the temp folder.
 */
async function assertNoTempFileVirtualDocs() {
  const tempDir = await vscode.workspace.fs.readDirectory(vscode.Uri.file(VIRTUAL_DOC_TEMP_DIRECTORY));
  const tempVdocFiles = tempDir.filter(([name]) => name.startsWith(".vdoc."));
  assert.strictEqual(
    tempVdocFiles.length,
    0,
    `Expected no virtual doc files in temp directory, but found ${tempVdocFiles.length}`
  );
}

async function withEmbeddedDiagnostics(
  uri: vscode.Uri,
  callback: () => Promise<void>,
) {
  // Create an event that fires when test diagnostics are received for the document.
  const diagnosticsSettledEvent = debounceEvent(onDidReceiveTestDiagnosticsForDocument(uri), 100);
  const promise = eventToPromise(diagnosticsSettledEvent);

  await callback();

  // Wait for diagnostics to settle.
  return await promise;
}
