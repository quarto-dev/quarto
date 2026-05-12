/*
 * embedded-diagnostics.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
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

import {
  Diagnostic,
  EventEmitter,
  TextDocument,
  Uri,
  languages,
  workspace,
} from "vscode";
import {
  Token,
  languageBlockAtPosition,
} from "quarto-core";

import { MarkdownEngine } from "../markdown/engine";
import { EmbeddedLanguage } from "../vdoc/languages";
import { allLanguages, virtualDocForLanguage, withVirtualDocUri } from "../vdoc/vdoc";
import { isQuartoDoc } from "../core/doc";
import { LogOutputChannel } from "vscode";
import path from "node:path";
import { Disposable } from "core";
import { ResourceMap } from "../core/resource-map";

interface DiagnosticsVirtualDocument {
  uri: Uri;
  language: EmbeddedLanguage;
  quartoDocumentUri: Uri;
  tokens: Token[];
  cleanup: () => void;
}

/** Event fired when embedded diagnostics are updated for a document. */
export interface DidUpdateDiagnosticsEvent {
  /** The URI of the Quarto document for which diagnostics were updated. */
  uri: Uri;

  /** The updated diagnostics for the Quarto document. */
  diagnostics: Diagnostic[];
}

export class EmbeddedDiagnosticsManager extends Disposable {
  private readonly _onDidUpdateDiagnostics = this._register(
    new EventEmitter<DidUpdateDiagnosticsEvent>()
  );

  /** Event fired when embedded diagnostics are updated for a document. */
  public readonly onDidUpdateDiagnostics = this._onDidUpdateDiagnostics.event;

  /** Diagnostic collection for Quarto documents. */
  private readonly diagnosticCollection = this._register(
    languages.createDiagnosticCollection("quarto-embedded")
  );

  /** Map of virtual document info keyed by virtual document URI. */
  private readonly vdocToReal = new ResourceMap<DiagnosticsVirtualDocument>();

  /**
   * Map of debounce timers keyed by Quarto document URI.
   * Document changes are debounced to avoid thrashing the language server
   * with rapid updates as the user types.
   */
  private readonly changeDebounceTimers = new ResourceMap<NodeJS.Timeout>();

  constructor(
    private engine: MarkdownEngine,
    private outputChannel: LogOutputChannel,
  ) {
    super();

    // Listen for diagnostics for known virtual documents.
    this._register(languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        const vdocInfo = this.vdocToReal.get(uri);
        if (vdocInfo) {
          this.handleDiagnosticsForVirtualDoc(uri, vdocInfo);
        }
      }
    }));

    // Listen for Quarto documents opening.
    this._register(workspace.onDidOpenTextDocument((doc) => {
      if (isQuartoDoc(doc)) {
        this.outputChannel.debug(
          `[EmbeddedDiagnosticsManager] Quarto document opened: ` +
          `${formatQuartoDocUri(doc.uri)}`
        );
        this.handleDocumentOpen(doc);
      }
    }));

    // Listen for Quarto documents changing.
    this._register(workspace.onDidChangeTextDocument((e) => {
      if (isQuartoDoc(e.document)) {
        this.outputChannel.debug(
          `[EmbeddedDiagnosticsManager] Quarto document changed: ` +
          `${formatQuartoDocUri(e.document.uri)}`
        );
        this.handleDocumentChange(e.document);
      }
    }));

    // Listen for Quarto documents closing.
    this._register(workspace.onDidCloseTextDocument((doc) => {
      if (isQuartoDoc(doc)) {
        this.outputChannel.debug(
          `[EmbeddedDiagnosticsManager] Quarto document closed: ` +
          `${formatQuartoDocUri(doc.uri)}`
        );
        this.handleDocumentClose(doc);
      }
    }));

    // Process already-open documents.
    workspace.textDocuments.forEach((doc) => {
      if (isQuartoDoc(doc)) {
        this.handleDocumentOpen(doc);
      }
    });
  }

  private async handleDocumentOpen(document: TextDocument): Promise<void> {
    this.createVirtualDocs(document);
  }

  private handleDocumentChange(document: TextDocument): void {
    const existingTimer = this.changeDebounceTimers.get(document.uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const debounceDelay = workspace.getConfiguration("quarto.cells.diagnostics").get("debounceDelay", 500);
    const timer = setTimeout(async () => {
      this.changeDebounceTimers.delete(document.uri);
      await this.recreateVirtualDocs(document);
    }, debounceDelay);

    this.changeDebounceTimers.set(document.uri, timer);
  }

  private handleDocumentClose(document: TextDocument): void {
    const timer = this.changeDebounceTimers.get(document.uri);
    if (timer) {
      clearTimeout(timer);
      this.changeDebounceTimers.delete(document.uri);
    }

    this.cleanupVirtualDocsForDocument(document.uri);

    // TODO: We shouldn't actually need to clear the diagnostic collection...
    // Although it's arguably the right call.
    // But we could also wait for the language server to clear the document's
    // diagnostics.
    this.deleteDiagnostics(document.uri);
  }

  private cleanupVirtualDocsForDocument(uri: Uri): void {
    const docKey = uri.toString();

    for (const [vdocKey, vdocInfo] of this.vdocToReal.entries()) {
      if (vdocInfo.quartoDocumentUri.toString() === docKey) {
        vdocInfo.cleanup();
        this.vdocToReal.delete(vdocKey);
      }
    }
  }

  private async recreateVirtualDocs(document: TextDocument): Promise<void> {
    this.cleanupVirtualDocsForDocument(document.uri);
    // TODO: Should we delete the diagnostic collection between waiting?
    await this.createVirtualDocs(document);
  }

  private async createVirtualDocs(document: TextDocument): Promise<void> {
    // Create a virtual document per language.
    const tokens = this.engine.parse(document);
    const languages = allLanguages(tokens);
    for (const language of languages) {
      try {
        const vdocContent = virtualDocForLanguage(document, tokens, language, "diagnostics");

        await withVirtualDocUri(vdocContent, document.uri, "diagnostics", async (uri: Uri) => {
          // Create a deferred promise.
          // It'll resolve when the vdoc info cleanup function is called
          // e.g. after we receive the vdoc's diagnostics.
          let resolve!: () => void;
          const promise = new Promise<void>((res) => resolve = res);

          const vdocInfo = {
            uri,
            language,
            quartoDocumentUri: document.uri,
            tokens,
            cleanup: () => {
              this.outputChannel.debug(
                "[EmbeddedDiagnosticsManager] Cleaning up virtual document: " +
                formatVirtualDoc(vdocInfo)
              );
              resolve();
            },
          } satisfies DiagnosticsVirtualDocument;
          this.vdocToReal.set(uri, vdocInfo);

          this.outputChannel.debug(
            `[EmbeddedDiagnosticsManager] Created virtual document: ` +
            formatVirtualDoc(vdocInfo, true)
          );
          this.outputChannel.trace(
            `[EmbeddedDiagnosticsManager] Virtual document content:\n` +
            vdocContent.content
          );

          // Wait for the promise to resolve.
          // Once this callback ends, the virtual document will be cleaned up.
          this.outputChannel.debug(
            "[EmbeddedDiagnosticsManager] Waiting for diagnostics for virtual document: " +
            formatVirtualDoc(vdocInfo)
          );
          await promise;
        });
      } catch (error) {
        this.outputChannel.error(
          `[EmbeddedDiagnosticsManager] Failed to create virtual document ` +
          `for ${formatQuartoDocUri(document.uri)} ` +
          `(language: ${language.ids[0]}): ` +
          JSON.stringify(error)
        );
      }
    }
  }

  private handleDiagnosticsForVirtualDoc(uri: Uri, vdocInfo: DiagnosticsVirtualDocument): void {
    const diagnostics = languages.getDiagnostics(uri);

    this.outputChannel.debug(
      `[EmbeddedDiagnosticsManager] Received ${diagnostics.length} diagnostics for ` +
      `virtual document: ${formatVirtualDoc(vdocInfo)}`
    );

    // Filter out diagnostics that don't map to a language block in the original document.
    const mappedDiagnostics: Diagnostic[] = [];
    for (const diagnostic of diagnostics) {
      const block = languageBlockAtPosition(vdocInfo.tokens, diagnostic.range.start);
      if (block !== undefined) {
        mappedDiagnostics.push(new Diagnostic(diagnostic.range, diagnostic.message, diagnostic.severity));
      } else {
        this.outputChannel.error(
          `[EmbeddedDiagnosticsManager] Could not find language block for diagnostic at ` +
          `[${diagnostic.range.start.line}, ${diagnostic.range.start.character}] ` +
          `in virtual document: ${formatVirtualDoc(vdocInfo)}`
        );
      }
    }

    this.setDiagnostics(vdocInfo.quartoDocumentUri, mappedDiagnostics);

    // We have diagnostics, so we can clean up the virtual doc.
    // This ensures that the virtual doc's diagnostics don't show
    // in the problems pane (or only show momentarily).
    this.cleanupVirtualDocsForDocument(vdocInfo.quartoDocumentUri);
  }

  private setDiagnostics(uri: Uri, diagnostics: Diagnostic[]): void {
    this.diagnosticCollection.set(uri, diagnostics);
    this._onDidUpdateDiagnostics.fire({
      uri,
      diagnostics,
    });
  }

  private deleteDiagnostics(uri: Uri): void {
    this.diagnosticCollection.delete(uri);
    this._onDidUpdateDiagnostics.fire({
      uri,
      diagnostics: [],
    });
  }

  dispose(): void {
    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.changeDebounceTimers.clear();

    for (const vdocInfo of this.vdocToReal.values()) {
      vdocInfo.cleanup();
    }
    this.vdocToReal.clear();
  }
}

function formatVirtualDoc(info: DiagnosticsVirtualDocument, fullUri = false) {
  return `${fullUri ? info.uri.toString() : path.basename(info.uri.fsPath)} ` +
    `(language: ${info.language.ids[0]}, ` +
    `quartoDocument: ${formatQuartoDocUri(info.quartoDocumentUri)})`;
}

function formatQuartoDocUri(uri: Uri) {
  return workspace.asRelativePath(uri);
}
