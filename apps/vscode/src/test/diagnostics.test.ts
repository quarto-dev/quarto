import * as assert from "assert";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { examplesUri, raceTimeout } from "./test-utils";
import { testLanguageClient } from "./fixtures/test-language-client";
import { DidUpdateDiagnosticsEvent, EmbeddedDiagnosticsManager, VdocDisposeReason } from "../providers/diagnostics";
import { MarkdownEngine } from "../markdown/engine";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";
import { assertNoLeakedVirtualDocs, deleteAllVirtualDocs } from "./utils/vdoc";
import { DisposableStore } from "core";
import { eventToPromise, filterEvent } from "./utils/event";

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
    // We check for leaked vdocs in teardown.
    await deleteAllVirtualDocs();
  });

  teardown(async function () {
    disposables.clear();
    await client.stop();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await assertNoLeakedVirtualDocs();
  });

  test("receives diagnostics in the .qmd for embedded languages", async function () {
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd");

    assert.strictEqual(event.diagnostics.length, 1, "Expected one diagnostic");
    assert.strictEqual(
      event.diagnostics[0].message,
      "test-diagnostic: undefined_var is not defined",
      "Expected diagnostic message to match"
    );
    assert.strictEqual(
      event.diagnostics[0].range.start.line,
      8,
      `Diagnostic should be on line 8, got line ${event.diagnostics[0].range.start.line}`
    );
  });

  test("updates diagnostics when .qmd edited", async function () {
    const { uri, event, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-none.qmd");

    assert.strictEqual(
      event.diagnostics.length,
      0,
      `Expected no initial diagnostics, got ${JSON.stringify(event.diagnostics)}`
    );

    const updated = nextDiagnostics(manager, uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(0, 0), "```{python}\nundefined_var\n```\n");
    });
    const updatedEvent = await raceTimeout(updated, 3000);
    assert.ok(updatedEvent, "Timed out waiting for updated diagnostics");

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
      const listener = manager.onDidUpdateDiagnostics((e) => {
        if (isUriEqual(e.documentUri, uri)) {
          events.push(e);
          if (events.length >= 2) {
            listener.dispose();
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

    const disposal = nextVdocDisposal(shortTimeoutManager, "timeout", "julia");
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(uri);

    const result = await raceTimeout(disposal, 2000);
    assert.ok(result, "Expected Julia vdoc to be disposed via timeout");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after timeout");
  });

  test("clears diagnostics when error is fixed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd");

    const cleared = nextDiagnostics(manager, uri);
    const editor = await vscode.window.showTextDocument(doc);
    const line = doc.lineAt(8);
    await editor.edit((editBuilder) => {
      editBuilder.replace(line.range, "x = 0");
    });
    const event = await raceTimeout(cleared, 4000);
    assert.ok(event, "Timed out waiting for diagnostics to clear");

    assert.strictEqual(
      event.diagnostics.length,
      0,
      "Diagnostics should be cleared after fixing the error"
    );
  });

  test("cleans up vdoc after diagnostics are received", async function () {
    const uri = examplesUri("diagnostics-python-undefined.qmd");
    const disposal = nextVdocDisposal(manager, "diagnostics-received", "python");
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(uri);

    const result = await raceTimeout(disposal, 4000);
    assert.ok(result, "Expected Python vdoc to be disposed after diagnostics received");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after diagnostics received");
  });

  test("cleans up vdoc when document is closed", async function () {
    // Julia (no LS in tests) so the vdoc stays alive long enough to be
    // disposed by closing the document rather than by receiving diagnostics.
    const uri = examplesUri("diagnostics-julia-only.qmd");
    const disposal = nextVdocDisposal(manager, "session-removed", "julia");

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await vscode.languages.setTextDocumentLanguage(doc, "plaintext");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    const result = await raceTimeout(disposal, 4000);
    assert.ok(result, "Expected vdoc to be disposed when document is closed");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
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

  test("clears diagnostics when all executable cells are removed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd");

    // Remove the entire code cell, leaving only markdown.
    const cleared = nextDiagnostics(manager, uri);
    const editor = await vscode.window.showTextDocument(doc);
    const fullRange = new vscode.Range(
      new vscode.Position(7, 0),
      new vscode.Position(doc.lineCount, 0)
    );
    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, "No code here.\n");
    });
    const event = await raceTimeout(cleared, 4000);
    assert.ok(event, "Timed out waiting for diagnostics to clear after removing all cells");

    assert.strictEqual(
      event.diagnostics.length,
      0,
      "Diagnostics should be cleared when no executable cells remain"
    );
  });

  test("clears diagnostics when document is closed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-offset.qmd");

    const cleared = nextDiagnostics(manager, uri);
    // We have to set the language to plaintext, since closing
    // documents/editors from an extension doesn't necessarily
    // trigger onDidCloseTextDocument therefore doesn't notify
    // the language server that textDocument/didClose.
    await vscode.languages.setTextDocumentLanguage(doc, "plaintext");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const event = await raceTimeout(cleared, 4000);
    assert.ok(event, "Timed out waiting for diagnostics to clear on close");

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

/**
 * Subscribe to the next diagnostics event for a URI.
 * Call before the triggering action.
 */
function nextDiagnostics(manager: EmbeddedDiagnosticsManager, uri: vscode.Uri) {
  return eventToPromise(
    filterEvent(
      manager.onDidUpdateDiagnostics,
      (e) => isUriEqual(e.documentUri, uri)
    )
  );
}

/**
 * Subscribe to the next vdoc disposal event matching reason and language.
 * Call before the triggering action.
 */
function nextVdocDisposal(
  manager: EmbeddedDiagnosticsManager,
  reason: VdocDisposeReason,
  language: string
) {
  return eventToPromise(
    filterEvent(
      manager.onDidDisposeVdoc,
      (e) => e.reason === reason && e.language === language
    )
  );
}

/** Open a .qmd fixture and wait for its first diagnostics event. */
async function openAndAwaitDiagnostics(manager: EmbeddedDiagnosticsManager, fixture: string) {
  const uri = examplesUri(fixture);
  const diagnostics = nextDiagnostics(manager, uri);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
  const event = await raceTimeout(diagnostics, 4000);
  if (!event) {
    throw new Error(`Timed out waiting for diagnostics on ${fixture}`);
  }
  return { uri, event, doc };
}
