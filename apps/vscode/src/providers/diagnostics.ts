/*
 * diagnostics.ts
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
  LogOutputChannel,
  TextDocument,
  Uri,
  extensions,
  languages,
  workspace,
} from "vscode";
import {
  TokenCodeBlock,
  TokenMath,
  languageBlockAtPosition,
} from "quarto-core";

import { MarkdownEngine } from "../markdown/engine";
import { EmbeddedLanguage, embeddedLanguage } from "../vdoc/languages";
import { languageBlocksByLanguage, virtualDocForLanguage } from "../vdoc/vdoc";
import { createVirtualDocFile } from "../vdoc/vdoc-tempfile";
import { isQuartoDoc } from "../core/doc";
import { Disposable } from "core";

const DEFAULT_TIMEOUT_MS = 10_000;

/** Event fired when embedded diagnostics are updated for a document. */
export interface DidUpdateDiagnosticsEvent {
  /** The URI of the Quarto document for which diagnostics were updated. */
  uri: Uri;

  /** The updated diagnostics for the Quarto document. */
  diagnostics: Diagnostic[];
}

interface ActiveVdoc {
  uri: Uri;
  cleanup: () => Promise<void>;
  timeout: NodeJS.Timeout;
}

interface DiagnosticSession {
  docUri: Uri;
  language: EmbeddedLanguage;
  languageBlocks: (TokenMath | TokenCodeBlock)[];
  activeVdoc?: ActiveVdoc;
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

  private readonly sessions: DiagnosticSession[] = [];
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly timeoutMs: number;

  constructor(
    private engine: MarkdownEngine,
    private outputChannel: LogOutputChannel,
    timeoutMs?: number,
  ) {
    super();
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Listen for diagnostics arriving on virtual documents.
    this._register(languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        const session = this.findSessionByVdocUri(uri);
        if (session) {
          this.handleDiagnosticsReceived(session, uri);
        }
      }
    }));

    // Document lifecycle.
    this._register(workspace.onDidOpenTextDocument((doc) => {
      if (isQuartoDoc(doc)) {
        this.handleDocumentOpen(doc);
      }
    }));

    this._register(workspace.onDidChangeTextDocument((e) => {
      if (isQuartoDoc(e.document)) {
        this.handleDocumentChange(e.document);
      }
    }));

    this._register(workspace.onDidCloseTextDocument((doc) => {
      if (isQuartoDoc(doc)) {
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

  // --- Document lifecycle ---

  private handleDocumentOpen(document: TextDocument): void {
    this.createSessionsForDocument(document);
  }

  private handleDocumentChange(document: TextDocument): void {
    const key = document.uri.toString();
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const debounceDelay = workspace
      .getConfiguration("quarto.cells.diagnostics")
      .get("debounceDelay", 500);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.recreateSessionsForDocument(document);
    }, debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  private handleDocumentClose(document: TextDocument): void {
    const key = document.uri.toString();

    // Cancel pending debounce.
    const timer = this.debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }

    // Dispose all sessions for this document.
    this.removeSessionsForDocument(document.uri);

    // Clear published diagnostics.
    this.diagnosticCollection.delete(document.uri);
    this._onDidUpdateDiagnostics.fire({ uri: document.uri, diagnostics: [] });
  }

  // --- Session management ---

  private async createSessionsForDocument(document: TextDocument): Promise<void> {
    const tokens = this.engine.parse(document);
    const blocksByLanguage = languageBlocksByLanguage(tokens);

    for (const [languageName, languageBlocks] of blocksByLanguage) {
      const language = embeddedLanguage(languageName);
      if (!language) {
        continue;
      }

      const session: DiagnosticSession = {
        docUri: document.uri,
        language,
        languageBlocks,
        diagnostics: [],
      };
      this.sessions.push(session);

      await this.activateSession(session, document);
    }
  }

  private async recreateSessionsForDocument(document: TextDocument): Promise<void> {
    // Dispose active vdocs but preserve stale diagnostics conceptually
    // (we remove sessions but the new ones start empty — publishDiagnostics
    // will use whatever the new sessions have).
    this.removeSessionsForDocument(document.uri);
    await this.createSessionsForDocument(document);
  }

  private removeSessionsForDocument(docUri: Uri): void {
    const docKey = docUri.toString();
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      if (this.sessions[i].docUri.toString() === docKey) {
        this.disposeActiveVdoc(this.sessions[i]);
        this.sessions.splice(i, 1);
      }
    }
  }

  private async activateSession(session: DiagnosticSession, document: TextDocument): Promise<void> {
    try {
      const tokens = this.engine.parse(document);
      const vdocContent = virtualDocForLanguage(
        document, tokens, session.language, "diagnostics"
      );

      const shouldUseLocal = this.shouldUseLocalTempFile(session.language);
      const { uri, cleanup } = await createVirtualDocFile(
        vdocContent, document.uri.fsPath, shouldUseLocal
      );

      const timeout = setTimeout(() => {
        this.handleTimeout(session);
      }, this.timeoutMs);

      session.activeVdoc = { uri, cleanup: cleanup!, timeout };

      this.outputChannel.debug(
        `[EmbeddedDiagnostics] Activated vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}`
      );
    } catch (error) {
      this.outputChannel.error(
        `[EmbeddedDiagnostics] Failed to create vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}: ` +
        JSON.stringify(error)
      );
    }
  }

  // --- Diagnostics handling ---

  private handleDiagnosticsReceived(session: DiagnosticSession, vdocUri: Uri): void {
    const rawDiagnostics = languages.getDiagnostics(vdocUri);

    this.outputChannel.debug(
      `[EmbeddedDiagnostics] Received ${rawDiagnostics.length} diagnostics for ` +
      `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}`
    );

    // Filter: only keep diagnostics that map to a real language block.
    const mapped: Diagnostic[] = [];
    for (const diagnostic of rawDiagnostics) {
      const block = languageBlockAtPosition(session.languageBlocks, diagnostic.range.start);
      if (block !== undefined) {
        mapped.push(new Diagnostic(diagnostic.range, diagnostic.message, diagnostic.severity));
      } else {
        this.outputChannel.error(
          `[EmbeddedDiagnostics] Could not find language block for diagnostic at ` +
          `[${diagnostic.range.start.line}, ${diagnostic.range.start.character}] ` +
          `for ${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}`
        );
      }
    }

    session.diagnostics = mapped;
    this.disposeActiveVdoc(session);
    this.publishDiagnostics(session.docUri);
  }

  private handleTimeout(session: DiagnosticSession): void {
    this.outputChannel.warn(
      `[EmbeddedDiagnostics] Language server for ${session.language.ids[0]} ` +
      `did not respond within ${this.timeoutMs}ms ` +
      `for ${workspace.asRelativePath(session.docUri)}`
    );
    this.disposeActiveVdoc(session);
  }

  private publishDiagnostics(docUri: Uri): void {
    const docKey = docUri.toString();
    const allDiagnostics = this.sessions
      .filter(s => s.docUri.toString() === docKey)
      .flatMap(s => s.diagnostics);

    this.diagnosticCollection.set(docUri, allDiagnostics);
    this._onDidUpdateDiagnostics.fire({ uri: docUri, diagnostics: allDiagnostics });
  }

  // --- Helpers ---

  private findSessionByVdocUri(uri: Uri): DiagnosticSession | undefined {
    const key = uri.toString();
    return this.sessions.find(s => s.activeVdoc?.uri.toString() === key);
  }

  private disposeActiveVdoc(session: DiagnosticSession): void {
    if (session.activeVdoc) {
      clearTimeout(session.activeVdoc.timeout);
      session.activeVdoc.cleanup();
      session.activeVdoc = undefined;
    }
  }

  private shouldUseLocalTempFile(language: EmbeddedLanguage): boolean {
    if (language.ids.includes("r")) {
      const rExt = extensions.getExtension("REditorSupport.r");
      if (rExt?.isActive) {
        const rLspConfig = workspace.getConfiguration("r.lsp");
        if (
          rLspConfig.get<boolean>("enabled", false) &&
          rLspConfig.get<boolean>("diagnostics", false)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public override dispose(): void {
    super.dispose();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    for (const session of this.sessions) {
      this.disposeActiveVdoc(session);
    }
    this.sessions.length = 0;
  }
}
