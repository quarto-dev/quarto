import * as assert from "assert";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { examplesUri, raceTimeout } from "./test-utils";
import { testLanguageClient } from "./fixtures/test-language-client";
import { DidUpdateDiagnosticsEvent, EmbeddedDiagnosticsManager } from "../providers/diagnostics";
import { MarkdownEngine } from "../markdown/engine";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";
import { assertNoLeakedVirtualDocs, deleteAllVirtualDocs } from "./utils/vdoc";
import { eventToPromise, filterEvent } from "../core/event";
import { DisposableStore } from "core";

/** Create a diagnostics manager for tests, registered with the given disposable store. */
function createTestManager(disposables: DisposableStore, timeoutMs?: number) {
  return disposables.add(
    new EmbeddedDiagnosticsManager(new MarkdownEngine(), new TestLogOutputChannel(), timeoutMs)
  );
}

suite("Diagnostics", function () {
  const disposables = new DisposableStore();
  let client: LanguageClient;
  let manager: EmbeddedDiagnosticsManager;

  setup(async function () {
    manager = createTestManager(disposables);

    // Start a test language server.
    client = testLanguageClient();
    await client.start();

    // Delete all vdocs before starting tests.
    await deleteAllVirtualDocs();
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

  test("receives diagnostics for multiple languages independently", async function () {
    this.timeout(15000);

    const uri = examplesUri("diagnostics-multilang.qmd");

    // Subscribe before opening so we don't miss events fired during document open.
    const events: DidUpdateDiagnosticsEvent[] = [];
    const gotBoth = new Promise<true>((resolve) => {
      const sub = manager.onDidUpdateDiagnostics((e) => {
        if (isUriEqual(e.uri, uri)) {
          events.push(e);
          if (events.length >= 2) {
            sub.dispose();
            resolve(true);
          }
        }
      });
    });

    // Open the document - should eventually get diagnostics for both languages.
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    const result = await raceTimeout(gotBoth, 12000);
    assert.strictEqual(result, true, "Timed out waiting for multi-language diagnostics");

    // The final published diagnostics should contain entries from both languages.
    const finalDiagnostics = vscode.languages.getDiagnostics(uri);
    assert.ok(
      finalDiagnostics.length >= 2,
      `Expected at least 2 diagnostics (one per language), got ${finalDiagnostics.length}`
    );
  });

  test("times out for unresponsive language servers without blocking others", async function () {
    // Julia has no language server registered in tests, so it will time out.
    // Python should still get its diagnostics independently.
    const uri = examplesUri("diagnostics-timeout.qmd");
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    // Wait for Python diagnostics to arrive; should not be blocked by Julia timing out
    const event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => { /* doc already opened above */ },
      "python diagnostics while julia times out",
      2000,
    );

    // Python diagnostics should be present despite Julia timing out.
    assert.ok(
      event.diagnostics.length >= 1,
      `Expected at least 1 diagnostic from Python, got ${event.diagnostics.length}`
    );
    assert.ok(
      event.diagnostics.some(d => d.message.includes("undefined_var")),
      "Expected Python diagnostic about undefined_var"
    );

  });

  test("cleans up vdoc after timeout when language server does not respond", async function () {
    const shortTimeoutManager = createTestManager(disposables, 200);

    const uri = examplesUri("diagnostics-julia-only.qmd");

    // Listen for the timeout dispose event on Julia's vdoc.
    const timeoutEvent = eventToPromise(
      filterEvent(
        shortTimeoutManager.onDidDisposeVdoc,
        (e) => e.reason === "timeout" && e.language === "julia"
      )
    );

    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(uri);

    const result = await raceTimeout(timeoutEvent, 2000);
    assert.ok(result, "Expected Julia vdoc to be disposed via timeout");

    // The vdoc temp file should no longer exist.
    const exists = await vscode.workspace.fs.stat(result.vdocUri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after timeout");
  });

  test("clears diagnostics when document is closed", async function () {
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

  await callback();

  const result = await raceTimeout(promise, timeout);
  if (!result) {
    throw new Error(`Timed out waiting for ${action}`);
  }
  return result;
}
