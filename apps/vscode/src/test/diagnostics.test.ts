import * as assert from "assert";
import * as vscode from "vscode";
import { randomUUID } from "crypto";
import { LanguageClient } from "vscode-languageclient/node";
import { examplesUri, raceTimeout } from "./test-utils";
import { testLanguageClient } from "./fixtures/test-language-client";
import { DidUpdateDiagnosticsEvent, EmbeddedDiagnosticsManager, VdocDisposeReason } from "../providers/diagnostics";
import { VIRTUAL_DOC_TEMP_DIRECTORY, deleteDocument, quartoVdocDir } from "../vdoc/vdoc-tempfile";
import { MarkdownEngine } from "../markdown/engine";
import { TestLogOutputChannel } from "./fixtures/test-log-output-channel";
import { DisposableStore } from "core";
import { eventToPromise, filterEvent } from "./utils/event";
import { Uri } from "vscode";

/** Create a diagnostics manager for tests, registered with the given disposable store. */
function createTestManager(disposables: DisposableStore, timeoutMs?: number) {
  return disposables.add(
    new EmbeddedDiagnosticsManager(new MarkdownEngine(), new TestLogOutputChannel(), timeoutMs)
  );
}

suite("Diagnostics", function () {
  const disposables = new DisposableStore();

  /** Test docs to be deleted during teardown. See the note on {@link openExampleTextDocument} */
  const toDelete: vscode.TextDocument[] = [];
  /** All vdoc URIs created during tests, to check for leaks during teardown. */
  const vdocUris: vscode.Uri[] = [];
  let client: LanguageClient;
  let manager: EmbeddedDiagnosticsManager;

  setup(async function () {
    manager = createTestManager(disposables);

    // Track vdoc URIs for the leak check during teardown.
    disposables.add(manager.onDidActivateVdoc((e) => {
      vdocUris.push(e.uri);
    }));

    // Start a test language server.
    client = testLanguageClient();
    await client.start();
  });

  teardown(async function () {
    disposables.clear();
    await Promise.all(toDelete.map(doc => deleteDocument(doc)));
    await client.stop();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // Check for leaked vdocs.
    const leaked = (await Promise.all(
      vdocUris.map(async (uri) => {
        const exists = await vscode.workspace.fs.stat(uri).then(() => true, () => false);
        return exists ? uri : null;
      })
    )).filter((uri): uri is vscode.Uri => uri !== null);
    assert.strictEqual(
      leaked.length,
      0,
      `Leaked vdocs:\n${leaked.map(u => u.fsPath).join("\n")}`
    );
    vdocUris.length = 0;
  });

  test("receives diagnostics in the .qmd for embedded languages", async function () {
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd", toDelete);

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
    const { uri, event, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-none.qmd", toDelete);

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

    const doc = await openExampleTextDocument("diagnostics-multilang.qmd", toDelete);
    const uri = doc.uri;

    // Subscribe before showing so we don't miss events fired during document open.
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
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-timeout.qmd", toDelete);

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
    const doc = await openExampleTextDocument("diagnostics-julia-only.qmd", toDelete);

    const disposal = nextVdocDisposal(shortTimeoutManager, "timeout", "julia");
    await vscode.window.showTextDocument(doc);

    const result = await raceTimeout(disposal, 2000);
    assert.ok(result, "Expected Julia vdoc to be disposed via timeout");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after timeout");
  });

  test("clears stale diagnostics after timeout", async function () {
    const shortTimeoutManager = createTestManager(disposables, 200);

    const { uri, doc } = await openAndAwaitDiagnostics(
      shortTimeoutManager, "diagnostics-timeout.qmd", toDelete
    );
    assert.ok(vscode.languages.getDiagnostics(uri).length >= 1, "Should have Python diagnostics initially");

    // Wait for the initial Julia timeout before editing,
    // otherwise nextDiagnostics catches that event instead.
    await raceTimeout(nextVdocDisposal(shortTimeoutManager, "timeout", "julia"), 2000);

    // Delete the Python cell, keeping only Julia (which will timeout).
    const cleared = nextDiagnostics(shortTimeoutManager, uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((editBuilder) => {
      editBuilder.delete(
        new vscode.Range(
          new vscode.Position(11, 0),
          new vscode.Position(doc.lineCount, 0)
        )
      );
    });

    const event = await raceTimeout(cleared, 3000);
    assert.ok(event, "Expected diagnostics update after timeout");
    assert.strictEqual(event.diagnostics.length, 0,
      "Stale Python diagnostics should be cleared after Julia-only timeout");
  });

  test("clears diagnostics when error is fixed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd", toDelete);

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
    const doc = await openExampleTextDocument("diagnostics-python-undefined.qmd", toDelete);
    const disposal = nextVdocDisposal(manager, "diagnostics-received", "python");
    await vscode.window.showTextDocument(doc);

    const result = await raceTimeout(disposal, 4000);
    assert.ok(result, "Expected Python vdoc to be disposed after diagnostics received");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after diagnostics received");
  });

  test("cleans up vdoc when document is closed", async function () {
    // Julia (no LS in tests) so the vdoc stays alive long enough to be
    // disposed by closing the document rather than by receiving diagnostics.
    const doc = await openExampleTextDocument("diagnostics-julia-only.qmd", toDelete);
    const disposal = nextVdocDisposal(manager, "session-removed", "julia");

    await vscode.window.showTextDocument(doc);
    await vscode.languages.setTextDocumentLanguage(doc, "plaintext");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    const result = await raceTimeout(disposal, 4000);
    assert.ok(result, "Expected vdoc to be disposed when document is closed");

    const exists = await vscode.workspace.fs.stat(result.uri).then(() => true, () => false);
    assert.strictEqual(exists, false, "Expected vdoc file to be deleted after document close");
  });

  test("reports diagnostics from multiple cells of the same language", async function () {
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-multicell.qmd", toDelete);

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
    const { event } = await openAndAwaitDiagnostics(manager, "diagnostics-python-offset.qmd", toDelete);

    const diagnostics = event.diagnostics;
    assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic");
    assert.strictEqual(
      diagnostics[0].range.start.line,
      13,
      `Diagnostic should be on line 13 (after extra content), got line ${diagnostics[0].range.start.line}`
    );
  });

  test("clears diagnostics when all executable cells are removed", async function () {
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-undefined.qmd", toDelete);

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
    const { uri, doc } = await openAndAwaitDiagnostics(manager, "diagnostics-python-offset.qmd", toDelete);

    const cleared = nextDiagnostics(manager, uri);
    await deleteDocument(doc);
    const event = await raceTimeout(cleared, 4000);
    assert.ok(event, "Timed out waiting for diagnostics to clear on close");

    assert.strictEqual(
      event.diagnostics.length,
      0,
      "Diagnostics should be cleared after closing the document"
    );
  });

  suite("vdoc location", () => {
    test("places typescript vdoc in local directory", async function () {
      const { uri, event } = await openAndAwaitVdocActivation(manager, "diagnostics-typescript.qmd", "ts", toDelete);
      const expectedDir = quartoVdocDir(uri.fsPath);
      assert.ok(
        event.uri.fsPath.startsWith(expectedDir),
        `Expected TypeScript vdoc in local dir (${expectedDir}), got ${event.uri.fsPath}`
      );
    });

    test("places python vdoc in global temp directory", async function () {
      const { event } = await openAndAwaitVdocActivation(manager, "diagnostics-python-undefined.qmd", "python", toDelete);
      assert.ok(
        event.uri.fsPath.startsWith(VIRTUAL_DOC_TEMP_DIRECTORY),
        `Expected Python vdoc in global temp dir (${VIRTUAL_DOC_TEMP_DIRECTORY}), got ${event.uri.fsPath}`
      );
    });
  });

  // The fixture contains "rich_diagnostic" which triggers the test language
  // server to emit a diagnostic with all optional fields populated: source,
  // code, tags, and relatedInformation (one URI pointing at the vdoc file
  // itself, one pointing at an external path).
  test("maps all diagnostic fields from the language server", async function () {
    const { uri, event } = await openAndAwaitDiagnostics(manager, "diagnostics-rich.qmd", toDelete);

    const rich = event.diagnostics.find(d => d.message.includes("rich diagnostic"));
    assert.ok(rich, "Expected a rich diagnostic");

    assert.strictEqual(rich.source, "test-linter");
    assert.strictEqual(rich.code, "rich-rule-001");
    assert.deepStrictEqual(rich.tags, [vscode.DiagnosticTag.Unnecessary]);

    assert.ok(rich.relatedInformation, "Expected relatedInformation");
    assert.strictEqual(rich.relatedInformation.length, 2);

    // First entry: URI should be rewritten from vdoc to the .qmd document.
    const localInfo = rich.relatedInformation[0];
    assert.strictEqual(
      localInfo.location.uri.toString(),
      uri.toString(),
      "relatedInformation URI pointing at vdoc should be rewritten to document URI"
    );
    assert.strictEqual(localInfo.location.range.start.line, 5);
    assert.strictEqual(localInfo.location.range.start.character, 0);
    assert.strictEqual(localInfo.message, "related info in same file (should be rewritten)");

    // Second entry: external URI should pass through unchanged.
    const externalInfo = rich.relatedInformation[1];
    assert.strictEqual(
      externalInfo.location.uri.toString(),
      "file:///usr/lib/python/typing.py",
      "relatedInformation URI pointing at external file should pass through unchanged"
    );
    assert.strictEqual(externalInfo.location.range.start.line, 42);
    assert.strictEqual(externalInfo.message, "related info in external file (should pass through)");
  });
});

/**
 * Copy a fixture file to a unique URI and open it.
 *
 * VS Code keeps text documents in memory even after their editors are closed,
 * so a fixture opened by one test remains in `workspace.textDocuments` for
 * subsequent tests. When `EmbeddedDiagnosticsManager` is constructed it
 * notifies the language server about all already-open documents.
 *
 * Copying to a fresh URI guarantees the document has never been seen before,
 * and lets us delete it to fire onDidCloseTextDocument events.
 */
async function openExampleTextDocument(fixture: string, toDelete: vscode.TextDocument[]): Promise<vscode.TextDocument> {
  const source = examplesUri(fixture);
  const dest = Uri.joinPath(source, "..", `tmp-${randomUUID()}-${fixture}`);
  await vscode.workspace.fs.copy(source, dest);
  const doc = await vscode.workspace.openTextDocument(dest);
  toDelete.push(doc);
  return doc;
}

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

/**
 * Subscribe to the next vdoc activation event matching a language.
 * Call before the triggering action.
 */
function nextVdocActivation(
  manager: EmbeddedDiagnosticsManager,
  documentUri: Uri,
  language: string
) {
  return eventToPromise(
    filterEvent(
      manager.onDidActivateVdoc,
      (e) => isUriEqual(e.documentUri, documentUri) &&
        e.language === language
    )
  );
}

/** Open a .qmd fixture and wait for its first diagnostics event. */
async function openAndAwaitDiagnostics(manager: EmbeddedDiagnosticsManager, fixture: string, toDelete: vscode.TextDocument[]) {
  const doc = await openExampleTextDocument(fixture, toDelete);
  const diagnostics = nextDiagnostics(manager, doc.uri);
  await vscode.window.showTextDocument(doc);
  const event = await raceTimeout(diagnostics, 4000);
  if (!event) {
    throw new Error(`Timed out waiting for diagnostics on ${fixture}`);
  }
  return { uri: doc.uri, event, doc };
}

/** Open a .qmd fixture and wait for its virtual document to activate for a given language. */
async function openAndAwaitVdocActivation(manager: EmbeddedDiagnosticsManager, fixture: string, language: string, toDelete: vscode.TextDocument[]) {
  const doc = await openExampleTextDocument(fixture, toDelete);
  const activation = nextVdocActivation(manager, doc.uri, language);
  await vscode.window.showTextDocument(doc);
  const event = await raceTimeout(activation, 4000);
  if (!event) {
    throw new Error(`Timed out waiting for vdoc activation for ${language} in ${fixture}`);
  }
  return { uri: doc.uri, event, doc };
}
