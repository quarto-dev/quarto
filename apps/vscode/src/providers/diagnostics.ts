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
import { virtualDocUriFromTempFile } from "../vdoc/vdoc-tempfile";
import { isQuartoDoc } from "../core/doc";
import { Disposable } from "core";

/** How long to wait for a language server to respond before giving up on a vdoc. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Event fired when embedded diagnostics are updated for a document. */
export interface DidUpdateDiagnosticsEvent {
  /** The URI of the Quarto document for which diagnostics were updated. */
  uri: Uri;

  /** The updated diagnostics for the Quarto document. */
  diagnostics: Diagnostic[];
}

/** Why a virtual document was disposed. */
export type VdocDisposeReason = 'diagnostics-received' | 'timeout' | 'session-removed';

/** Event fired when a virtual document is disposed. */
export interface DidDisposeVdocEvent {
  /** The Quarto document the vdoc belonged to. */
  docUri: Uri;
  /** The language the vdoc was created for (e.g. "python", "r"). */
  language: string;
  /** The URI of the virtual document that was disposed. */
  vdocUri: Uri;
  /** Why the vdoc was disposed. */
  reason: VdocDisposeReason;
}

/** A virtual document that is actively waiting for diagnostics from a language server. */
interface ActiveVdoc {
  /** URI of the temp file opened as a text document. */
  uri: Uri;
  /** Deletes the temp file and resets its language so the LS clears diagnostics. */
  cleanup: () => Promise<void>;
  /** Fires if the language server doesn't respond in time. */
  timeout: NodeJS.Timeout;
}

/**
 * Tracks the diagnostic state for one embedded language in one Quarto document.
 * Each language operates independently — its timeout, vdoc lifecycle, and stored
 * diagnostics don't interfere with other languages in the same document.
 */
interface DiagnosticSession {
  /** The Quarto document this session belongs to. */
  docUri: Uri;
  /** The embedded language (Python, R, etc.). */
  language: EmbeddedLanguage;
  /** Code blocks for this language, used to filter diagnostics by position. */
  languageBlocks: (TokenMath | TokenCodeBlock)[];
  /** The active virtual document awaiting diagnostics, if any. */
  activeVdoc?: ActiveVdoc;
  /** Last received diagnostics for this language (stale-until-replaced on edits). */
  diagnostics: Diagnostic[];
}

/**
 * Surfaces language-server diagnostics from embedded code cells in Quarto documents.
 *
 * Creates a temporary virtual document per language, waits for the language server
 * to publish diagnostics on it, then maps the diagnostics back onto the original
 * `.qmd` file. Each language's lifecycle is independent — one slow or non-responsive
 * language server won't block diagnostics from other languages.
 */
export class EmbeddedDiagnosticsManager extends Disposable {
  private readonly _onDidUpdateDiagnostics = this._register(
    new EventEmitter<DidUpdateDiagnosticsEvent>()
  );

  /** Event fired when embedded diagnostics are updated for a document. */
  public readonly onDidUpdateDiagnostics = this._onDidUpdateDiagnostics.event;

  private readonly _onDidDisposeVdoc = this._register(
    new EventEmitter<DidDisposeVdocEvent>()
  );

  /** Event fired when a virtual document is disposed (for any reason). */
  public readonly onDidDisposeVdoc = this._onDidDisposeVdoc.event;

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
    this._register(languages.onDidChangeDiagnostics(async (event) => {
      for (const uri of event.uris) {
        const session = this.findSessionByVdocUri(uri);
        if (session) {
          await this.handleDiagnosticsReceived(session, uri);
        }
      }
    }));

    // Document lifecycle.
    this._register(workspace.onDidOpenTextDocument(async (doc) => {
      if (isQuartoDoc(doc)) {
        await this.handleDocumentOpen(doc);
      }
    }));

    this._register(workspace.onDidChangeTextDocument(async (e) => {
      if (isQuartoDoc(e.document)) {
        await this.handleDocumentChange(e.document);
      }
    }));

    this._register(workspace.onDidCloseTextDocument(async (doc) => {
      if (isQuartoDoc(doc)) {
        await this.handleDocumentClose(doc);
      }
    }));

    // Process already-open documents.
    for (const doc of workspace.textDocuments) {
      if (isQuartoDoc(doc)) {
        this.handleDocumentOpen(doc).catch((error) => {
          this.outputChannel.error(
            `[EmbeddedDiagnostics] Failed to initialize ${workspace.asRelativePath(doc.uri)}: ` +
            JSON.stringify(error)
          );
        });
      }
    }
  }

  // --- Document lifecycle ---

  private async handleDocumentOpen(document: TextDocument): Promise<void> {
    await this.createSessionsForDocument(document);
  }

  private async handleDocumentChange(document: TextDocument): Promise<void> {
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
      this.recreateSessionsForDocument(document).catch((error) => {
        this.outputChannel.error(
          `[EmbeddedDiagnostics] Failed to recreate sessions for ` +
          `${workspace.asRelativePath(document.uri)}: ` +
          JSON.stringify(error)
        );
      });
    }, debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  private async handleDocumentClose(document: TextDocument): Promise<void> {
    const key = document.uri.toString();

    // Cancel pending debounce.
    const timer = this.debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }

    // Dispose all sessions for this document.
    await this.removeSessionsForDocument(document.uri);

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
    await this.removeSessionsForDocument(document.uri);
    await this.createSessionsForDocument(document);
  }

  private async removeSessionsForDocument(docUri: Uri): Promise<void> {
    const docKey = docUri.toString();
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      if (this.sessions[i].docUri.toString() === docKey) {
        await this.disposeActiveVdoc(this.sessions[i], 'session-removed');
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
      const { uri, cleanup } = await virtualDocUriFromTempFile(
        vdocContent, document.uri.fsPath, shouldUseLocal, false
      );

      const timeout = setTimeout(async () => {
        this.outputChannel.warn(
          `[EmbeddedDiagnostics] Language server for ${session.language.ids[0]} ` +
          `did not respond within ${this.timeoutMs}ms ` +
          `for ${workspace.asRelativePath(session.docUri)}`
        );
        await this.disposeActiveVdoc(session, 'timeout');
      }, this.timeoutMs);

      session.activeVdoc = { uri, cleanup: cleanup!, timeout };

      this.outputChannel.debug(
        `[EmbeddedDiagnostics] Activated vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}: ` +
        uri.toString()
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

  private async handleDiagnosticsReceived(session: DiagnosticSession, vdocUri: Uri): Promise<void> {
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
    await this.disposeActiveVdoc(session, 'diagnostics-received');
    this.publishDiagnostics(session.docUri);
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

  private async disposeActiveVdoc(session: DiagnosticSession, reason: VdocDisposeReason): Promise<void> {
    if (session.activeVdoc) {
      const vdocUri = session.activeVdoc.uri;
      clearTimeout(session.activeVdoc.timeout);
      await session.activeVdoc.cleanup();
      session.activeVdoc = undefined;

      this.outputChannel.debug(
        `[EmbeddedDiagnostics] Disposed vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)} ` +
        `(reason: ${reason})`
      );
      this._onDidDisposeVdoc.fire({
        docUri: session.docUri,
        language: session.language.ids[0],
        vdocUri,
        reason,
      });
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
      this.disposeActiveVdoc(session, 'session-removed').catch((error) => {
        this.outputChannel.error(
          `[EmbeddedDiagnostics] Failed to dispose vdoc for ` +
          `${session.language.ids[0]} in ${workspace.asRelativePath(session.docUri)}: ` +
          JSON.stringify(error)
        );
      });
    }
    this.sessions.length = 0;
  }
}
