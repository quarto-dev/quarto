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
    const { uri, event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd");

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
    const { uri, event, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-none.qmd");

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

    const updatedEvent = await withEmbeddedDiagnostics(
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
      updatedEvent.uri.toString(),
      uri.toString(),
      "Expected diagnostics for the opened document"
    );

    assert.strictEqual(
      updatedEvent.diagnostics.length,
      1,
      `Expected one diagnostic after adding a cell, got ${updatedEvent.diagnostics.length}`
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
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-timeout.qmd");

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

  test("clears diagnostics when error is fixed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd");

    // Replace `undefined_var` with a valid expression to fix the error.
    const event = await withEmbeddedDiagnostics(
      manager,
      uri,
      async () => {
        const editor = await vscode.window.showTextDocument(doc);
        const line = doc.lineAt(8);
        await editor.edit((editBuilder) => {
          editBuilder.replace(line.range, "x = 0");
        });
      },
      "diagnostics cleared after fixing error"
    );

    assert.strictEqual(
      event.diagnostics.length,
      0,
      "Diagnostics should be cleared after fixing the error"
    );
  });

  test("cleans up vdoc after diagnostics are received", async function () {
    // Listen for vdoc disposal with reason "diagnostics-received".
    const disposeEvent = eventToPromise(
      filterEvent(
        manager.onDidDisposeVdoc,
        (e) => e.reason === "diagnostics-received" && e.language === "python"
      )
    );

    const uri = examplesUri("diagnostics-python-undefined.qmd");
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(uri);

    const result = await raceTimeout(disposeEvent, 4000);
    assert.ok(result, "Expected Python vdoc to be disposed after diagnostics received");

    // The vdoc temp file should no longer exist.
    const exists = await vscode.workspace.fs.stat(result.vdocUri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after diagnostics received");
  });

  test("cleans up vdoc when document is closed", async function () {
    // Use a file with Julia only (no LS in tests) so the vdoc stays alive
    // long enough to be disposed by closing the document rather than by
    // receiving diagnostics.
    const uri = examplesUri("diagnostics-julia-only.qmd");

    // Listen for vdoc disposal with reason "session-removed".
    const disposeEvent = eventToPromise(
      filterEvent(
        manager.onDidDisposeVdoc,
        (e) => e.reason === "session-removed" && e.language === "julia"
      )
    );

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    // Close the document before the default timeout fires.
    await vscode.languages.setTextDocumentLanguage(doc, "plaintext");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    const result = await raceTimeout(disposeEvent, 4000);
    assert.ok(result, "Expected vdoc to be disposed when document is closed");

    const exists = await vscode.workspace.fs.stat(result.vdocUri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after document close");
  });

  test("reports diagnostics from multiple cells of the same language", async function () {
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-multicell.qmd");

    const diagnostics = event.diagnostics;
    assert.strictEqual(diagnostics.length, 2, "Expected one diagnostic per cell");

    const lines = diagnostics.map(d => d.range.start.line).sort((a, b) => a - b);
    assert.deepStrictEqual(
      lines,
      [8, 14],
      `Expected diagnostics on lines 8 and 14, got ${JSON.stringify(lines)}`
    );
  });

  test("maps diagnostic line numbers correctly with content above cell", async function () {
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-offset.qmd");

    const diagnostics = event.diagnostics;
    assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic");
    assert.strictEqual(
      diagnostics[0].range.start.line,
      13,
      `Diagnostic should be on line 13 (after extra content), got line ${diagnostics[0].range.start.line}`
    );
  });

  test("clears diagnostics when document is closed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-offset.qmd");

    // Close the document - the manager should clear diagnostics for the document.
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

/** Open a .qmd fixture and wait for its first diagnostics event. */
async function openAndAwaitDiagnostics(manager: EmbeddedDiagnosticsManager, fixture: string) {
  const uri = examplesUri(fixture);
  let doc!: vscode.TextDocument;
  const event = await withEmbeddedDiagnostics(
    manager,
    uri,
    async () => {
      doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(uri);
    },
    "initial diagnostics on document open"
  );
  return { uri, event, doc };
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
