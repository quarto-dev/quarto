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
  Disposable as VscodeDisposable,
} from "vscode";
import {
  Token,
  TokenCodeBlock,
  TokenMath,
  isExecutableLanguageBlock,
  languageBlockAtPosition,
  languageNameFromBlock,
} from "quarto-core";

import { MarkdownEngine } from "../markdown/engine";
import { EmbeddedLanguage, embeddedLanguage } from "../vdoc/languages";
import { virtualDocForLanguage } from "../vdoc/vdoc";
import { virtualDocUriFromTempFile, quartoVdocDir, VIRTUAL_DOC_TEMP_DIRECTORY } from "../vdoc/vdoc-tempfile";
import { isQuartoDoc } from "../core/doc";
import { Disposable } from "core";

/** How long to wait for a language server to respond before giving up on a vdoc. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Event fired when embedded diagnostics are updated for a document. */
export interface DidUpdateDiagnosticsEvent {
  /** The URI of the document for which diagnostics were updated. */
  readonly documentUri: Uri;

  /** The updated diagnostics for the document. */
  readonly diagnostics: Diagnostic[];
}

/** Why a virtual document was disposed. */
export type VdocDisposeReason = 'diagnostics-received' | 'timeout' | 'document-changed' | 'session-removed';

/** Event fired when a virtual document is disposed. */
export interface DidDisposeVdocEvent {
  /** The URI of the virtual document that was disposed. */
  readonly uri: Uri;

  /** The document the vdoc belonged to. */
  readonly documentUri: Uri;

  /** The language the vdoc was created for (e.g. "python", "r"). */
  readonly language: string;

  /** Why the vdoc was disposed. */
  readonly reason: VdocDisposeReason;
}

/** A virtual document that is actively waiting for diagnostics from a language server. */
interface ActiveVdoc {
  /** URI of the temp file opened as a text document. */
  readonly uri: Uri;

  /** Clean up the virtual document. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Tracks the diagnostic state for an embedded language in a document.
 */
interface DiagnosticSession {
  /** The document this session belongs to. */
  readonly documentUri: Uri;

  /** The embedded language (Python, R, etc.). */
  readonly language: EmbeddedLanguage;

  /** Code blocks for this language, used to filter diagnostics by position. */
  readonly languageBlocks: (TokenMath | TokenCodeBlock)[];

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
 * `.qmd` file. Each language's lifecycle is independent - one slow or non-responsive
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

  /** Event fired when a virtual document is disposed. */
  public readonly onDidDisposeVdoc = this._onDidDisposeVdoc.event;

  /** Diagnostic collection for Quarto documents. */
  private readonly diagnosticCollection = this._register(
    languages.createDiagnosticCollection("quarto")
  );

  /** Active diagnostic sessions, one per document and language. */
  private readonly sessions: DiagnosticSession[] = [];

  /** Debounce timers for document changes, keyed by URI string. */
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly engine: MarkdownEngine,
    private readonly outputChannel: LogOutputChannel,
    /** Timeout for waiting for the language server to publish diagnostics. */
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    super();

    // Listen for diagnostics arriving on virtual documents.
    this._register(languages.onDidChangeDiagnostics(async (event) => {
      for (const uri of event.uris) {
        const session = this.getSessionForVdoc(uri);
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
    await this.removeSessionsForDocument(document.uri, "session-removed");

    // Clear published diagnostics.
    this.diagnosticCollection.delete(document.uri);
    this._onDidUpdateDiagnostics.fire({ documentUri: document.uri, diagnostics: [] });
  }

  // --- Session management ---

  private async createSessionsForDocument(document: TextDocument): Promise<void> {
    const tokens = this.engine.parse(document);

    // Create or append blocks to each language's session for the document.
    for (const block of tokens.filter(isExecutableLanguageBlock)) {
      const languageName = languageNameFromBlock(block);
      if (!languageName) { continue; }
      const language = embeddedLanguage(languageName);
      if (!language) { continue; }
      const session = this.getOrCreateSession(document.uri, language);
      session.languageBlocks.push(block);
    }

    const docSessions = this.getSessionsForDocument(document.uri);
    if (docSessions.length === 0) {
      // No executable cells - clear stale diagnostics that
      // won't be superseded by a new vdoc round-trip.
      this.diagnosticCollection.delete(document.uri);
      this._onDidUpdateDiagnostics.fire({ documentUri: document.uri, diagnostics: [] });
      return;
    } else {
      // Concurrently activate sessions for this document.
      await Promise.all(docSessions.map(s => this.activateSession(s, document, tokens)));
    }
  }

  private async recreateSessionsForDocument(document: TextDocument): Promise<void> {
    await this.removeSessionsForDocument(document.uri, "document-changed");
    await this.createSessionsForDocument(document);
  }

  private async activateSession(
    session: DiagnosticSession,
    document: TextDocument,
    tokens: Token[],
  ): Promise<void> {
    try {
      const vdocContent = virtualDocForLanguage(
        document, tokens, session.language, "diagnostics"
      );

      const dir = this.shouldUseLocalTempFile(session.language)
        ? quartoVdocDir(document.uri.fsPath)
        : VIRTUAL_DOC_TEMP_DIRECTORY;
      const vdoc = await virtualDocUriFromTempFile(
        vdocContent, dir, { warmup: false }
      );

      const timeout = setTimeout(async () => {
        this.outputChannel.warn(
          `[EmbeddedDiagnostics] Language server for ${session.language.ids[0]} ` +
          `did not respond within ${this.timeoutMs}ms ` +
          `for ${workspace.asRelativePath(session.documentUri)}`
        );
        await this.disposeActiveVdoc(session, 'timeout');
      }, this.timeoutMs);

      session.activeVdoc = {
        uri: vdoc.uri,
        cleanup: async () => {
          clearTimeout(timeout);
          if (vdoc.cleanup) {
            await vdoc.cleanup();
          }
        },
      };

      this.outputChannel.debug(
        `[EmbeddedDiagnostics] Activated vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.documentUri)}: ` +
        vdoc.uri.toString()
      );
    } catch (error) {
      this.outputChannel.error(
        `[EmbeddedDiagnostics] Failed to create vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.documentUri)}: ` +
        JSON.stringify(error)
      );
    }
  }

  // --- Diagnostics handling ---

  private async handleDiagnosticsReceived(session: DiagnosticSession, vdocUri: Uri): Promise<void> {
    const rawDiagnostics = languages.getDiagnostics(vdocUri);

    this.outputChannel.debug(
      `[EmbeddedDiagnostics] Received ${rawDiagnostics.length} diagnostics for ` +
      `${session.language.ids[0]} in ${workspace.asRelativePath(session.documentUri)}`
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
          `for ${session.language.ids[0]} in ${workspace.asRelativePath(session.documentUri)}`
        );
      }
    }

    session.diagnostics = mapped;
    await this.disposeActiveVdoc(session, 'diagnostics-received');
    this.publishDiagnostics(session.documentUri);
  }

  private publishDiagnostics(documentUri: Uri): void {
    const allDiagnostics = this.getSessionsForDocument(documentUri)
      .flatMap(s => s.diagnostics);

    this.diagnosticCollection.set(documentUri, allDiagnostics);
    this._onDidUpdateDiagnostics.fire({ documentUri: documentUri, diagnostics: allDiagnostics });
  }

  // --- Helpers ---

  private getSession(uri: Uri, language: EmbeddedLanguage): DiagnosticSession | undefined {
    const key = uri.toString();
    return this.sessions.find(
      s => s.documentUri.toString() === key &&
        s.language.ids[0] === language.ids[0]
    );
  }

  private getOrCreateSession(documentUri: Uri, language: EmbeddedLanguage): DiagnosticSession {
    let session = this.getSession(documentUri, language);
    if (!session) {
      session = {
        documentUri,
        language,
        languageBlocks: [],
        diagnostics: []
      };
      this.sessions.push(session);
    }
    return session;
  }

  private getSessionsForDocument(documentUri: Uri): DiagnosticSession[] {
    const key = documentUri.toString();
    return this.sessions.filter(s => s.documentUri.toString() === key);
  }

  private getSessionForVdoc(uri: Uri): DiagnosticSession | undefined {
    const key = uri.toString();
    return this.sessions.find(s => s.activeVdoc?.uri.toString() === key);
  }

  private async removeSessionsForDocument(documentUri: Uri, reason: VdocDisposeReason): Promise<void> {
    const docKey = documentUri.toString();
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      if (this.sessions[i].documentUri.toString() === docKey) {
        await this.disposeActiveVdoc(this.sessions[i], reason);
        this.sessions.splice(i, 1);
      }
    }
  }

  private async disposeActiveVdoc(session: DiagnosticSession, reason: VdocDisposeReason): Promise<void> {
    const { activeVdoc } = session;
    if (activeVdoc) {
      // First unset the session's active vdoc so that we don't accidentally
      // process diagnostics that arrive while we're cleaning up the old vdoc.
      session.activeVdoc = undefined;

      await activeVdoc.cleanup();

      this.outputChannel.debug(
        `[EmbeddedDiagnostics] Disposed vdoc for ` +
        `${session.language.ids[0]} in ${workspace.asRelativePath(session.documentUri)} ` +
        `(reason: ${reason})`
      );
      this._onDidDisposeVdoc.fire({
        documentUri: session.documentUri,
        language: session.language.ids[0],
        uri: activeVdoc.uri,
        reason,
      });
    }
  }

  private shouldUseLocalTempFile(language: EmbeddedLanguage): boolean {
    // The vscode-R extension uses the languageserver R package
    // which does not provide diagnostics for files in the system
    // temp directory. Use a local temp file in that case.
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

    // Default to a non-local temp file - it's less invasive.
    return false;
  }

  /** Settled when all active vdocs from dispose() have been cleaned up. */
  private _disposePromise?: Promise<PromiseSettledResult<void>[]>;

  public override dispose(): void {
    super.dispose();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Best-effort async cleanup — awaited via deactivate() during extension deactivation.
    this._disposePromise = Promise.allSettled(
      this.sessions
        .filter(s => s.activeVdoc)
        .map(s => this.disposeActiveVdoc(s, 'session-removed'))
    );
    this.sessions.length = 0;
  }

  /**
   * Awaitable cleanup for use during extension deactivation.
   * Resolves when all active vdocs have been disposed (or failed).
   */
  async deactivate(): Promise<void> {
    await this._disposePromise;
  }
}

export interface EmbeddedDiagnosticsService extends VscodeDisposable {
  /** Awaitable cleanup for use during extension deactivation. */
  deactivate(): Promise<void>;
}

/**
 * Activates cell diagnostics if enabled, and watches for setting changes
 * to create/dispose the manager dynamically.
 */
export function activateEmbeddedDiagnostics(
  engine: MarkdownEngine,
  outputChannel: LogOutputChannel,
): EmbeddedDiagnosticsService {
  let manager: EmbeddedDiagnosticsManager | undefined;

  function isEnabled(): boolean {
    return workspace
      .getConfiguration("quarto.cells.diagnostics")
      .get<boolean>("enabled", true);
  }

  function createManager(): void {
    if (!manager) {
      manager = new EmbeddedDiagnosticsManager(engine, outputChannel);
    }
  }

  function disposeManager(): void {
    if (manager) {
      manager.dispose();
      manager = undefined;
    }
  }

  if (isEnabled()) {
    createManager();
  }

  const configListener = workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("quarto.cells.diagnostics.enabled")) {
      if (isEnabled()) {
        createManager();
      } else {
        disposeManager();
      }
    }
  });

  return Object.assign(
    new VscodeDisposable(() => {
      configListener.dispose();
      disposeManager();
    }),
    { deactivate: () => manager?.deactivate() ?? Promise.resolve() }
  );
}
