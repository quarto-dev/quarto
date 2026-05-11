import * as assert from "assert";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { examplesUri, raceTimeout } from "./test-utils";
import { testLanguageClient } from "./fixtures/test-language-client";
import { EmbeddedDiagnosticsManager } from "../providers/embedded-diagnostics";
import { MarkdownEngine } from "../markdown/engine";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";
import { assertNoLeakedVirtualDocs } from "./utils/vdoc";
import { eventToPromise, filterEvent } from "../core/event";
import { DisposableStore } from "core";

suite("Diagnostics", function () {
  const disposables = new DisposableStore();
  let client: LanguageClient;
  let manager: EmbeddedDiagnosticsManager;

  setup(async function () {
    // Create our own diagnostics manager rather than using the extension's
    // so that we can directly listen for diagnostics changed events
    // and see the output channel logs in the test output.
    const engine = new MarkdownEngine();
    const outputChannel = new TestLogOutputChannel();
    manager = disposables.add(new EmbeddedDiagnosticsManager(engine, outputChannel));

    // Start a test language server.
    client = testLanguageClient();
    await client.start();
  });

  teardown(async function () {
    disposables.clear();
    await client.stop();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await assertNoLeakedVirtualDocs();
  });

  test("receives diagnostics in the .qmd for embedded languages", async function () {
    const uri = examplesUri("diagnostics-python-undefined.qmd");
    const event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(uri);
      },
      "initial diagnostics on document open"
    );

    assert.strictEqual(
      event.uri.toString(),
      uri.toString(),
      "Expected diagnostics for the opened document"
    );

    const diagnostics = event.diagnostics;
    assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic");
    assert.strictEqual(
      diagnostics[0].message,
      "test-diagnostic: undefined_var is not defined",
      "Expected diagnostic message to match"
    );
    assert.strictEqual(
      diagnostics[0].range.start.line,
      8,
      `Diagnostic should be on line 8, got line ${diagnostics[0].range.start.line}`
    );
  });

  test("updates diagnostics when .qmd edited", async function () {
    const uri = examplesUri("diagnostics-python-none.qmd");
    // Open the document - the language server should respond with diagnostics.
    let doc!: vscode.TextDocument;
    let event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(uri);
      },
      "initial diagnostics on document open"
    );

    assert.strictEqual(
      event.uri.toString(),
      uri.toString(),
      "Expected diagnostics for the opened document"
    );

    assert.strictEqual(
      event.diagnostics.length,
      0,
      `Expected no initial diagnostics, got ${JSON.stringify(event.diagnostics)}`

    );

    event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        const editor = await vscode.window.showTextDocument(doc);
        await editor.edit((editBuilder) => {
          editBuilder.insert(new vscode.Position(0, 0), "```{python}\nundefined_var\n```\n");
        });
      },
      "updated diagnostics on document change"
    );

    assert.strictEqual(
      event.uri.toString(),
      uri.toString(),
      "Expected diagnostics for the opened document"
    );

    assert.strictEqual(
      event.diagnostics.length,
      1,
      `Expected one diagnostic after adding a cell, got ${event.diagnostics.length}`
    );
  });

  test("clears diagnostics when document is closed", async function () {
    console.log("STARTING CLEAR DIAGNOSTICS TEST ****************");
    const uri = examplesUri("diagnostics-python-undefined.qmd");
    let doc!: vscode.TextDocument;
    await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(uri);
      },
      "initial diagnostics on document open"
    );

    // Close the document - the language server should clear diagnostics for the document.
    // TODO: Delete files if diagnostics never arrive - first a test case
    // TODO: Think of more test cases and ask Claude too
    const event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        await vscode.languages.setTextDocumentLanguage(doc, "plaintext");
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      },
      "diagnostics cleared on document close"
    );

    assert.strictEqual(
      event.uri.toString(),
      uri.toString(),
      "Expected diagnostics for the closed document"
    );

    assert.strictEqual(
      event.diagnostics.length,
      0,
      "Diagnostics should be cleared after closing the document"
    );
  });
});

function isUriEqual(a: vscode.Uri, b: vscode.Uri) {
  return a.toString() === b.toString();
}

async function withEmbeddedDiagnostics(
  manager: EmbeddedDiagnosticsManager,
  uri: vscode.Uri,
  callback: () => Promise<void>,
  action: string,
  timeout = 4000,
) {
  // Create a promise that resolves when diagnostics update for `uri`.
  const promise = eventToPromise(
    filterEvent(
      manager.onDidUpdateDiagnostics,
      (e) => isUriEqual(e.uri, uri)
    )
  );

  console.log(`Waiting for ${action}...`);

  await callback();

  const result = await raceTimeout(promise, timeout);
  if (!result) {
    throw new Error(`Timed out waiting for ${action}`);
  }
  return result;
}
