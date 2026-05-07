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
  DiagnosticCollection,
  Disposable,
  TextDocument,
  Uri,
  languages,
  workspace,
} from "vscode";
import {
  Token,
  isExecutableLanguageBlock,
  languageBlockAtPosition,
  languageNameFromBlock,
} from "quarto-core";

import { MarkdownEngine } from "../markdown/engine";
import { embeddedLanguage, EmbeddedLanguage } from "../vdoc/languages";
import { VirtualDoc, withVirtualDocUri } from "../vdoc/vdoc";
import { isQuartoDoc } from "../core/doc";
import { LogOutputChannel } from "vscode";

interface VirtualDocInfo {
  realDocUri: Uri;
  tokens: Token[];
  cleanup: () => void;
}

export class EmbeddedDiagnosticsManager implements Disposable {
  private diagnosticCollection: DiagnosticCollection;
  private vdocToReal = new Map<string, VirtualDocInfo>();
  private disposables: Disposable[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private engine: MarkdownEngine,
    private outputChannel: LogOutputChannel,
  ) {
    this.diagnosticCollection = languages.createDiagnosticCollection("quarto-embedded");
    this.disposables.push(this.diagnosticCollection);

    this.disposables.push(
      // TODO: can we listen more specifically to particular vdocs?
      // Listen to diagnostic changes from all language servers
      languages.onDidChangeDiagnostics((event) => {
        for (const uri of event.uris) {
          const vdocInfo = this.vdocToReal.get(uri.toString());
          if (vdocInfo) {
            this.handleDiagnosticsForVirtualDoc(uri, vdocInfo);
          }
        }
      }),

      // Register document listeners
      workspace.onDidOpenTextDocument((doc) => {
        if (isQuartoDoc(doc)) {
          this.handleDocumentOpen(doc);
        }
      }),
      workspace.onDidChangeTextDocument((e) => {
        if (isQuartoDoc(e.document)) {
          this.handleDocumentChange(e.document);
        }
      }),
      workspace.onDidCloseTextDocument((doc) => {
        if (isQuartoDoc(doc)) {
          this.handleDocumentClose(doc);
        }
      })
    );

    // Process already-open documents
    workspace.textDocuments.forEach((doc) => {
      if (isQuartoDoc(doc)) {
        this.handleDocumentOpen(doc);
      }
    });
  }

  private async handleDocumentOpen(document: TextDocument): Promise<void> {
    if (!workspace.getConfiguration("quarto.cells.diagnostics").get("enabled", true)) {
      return;
    }
    this.createVirtualDocs(document);
  }

  private handleDocumentChange(document: TextDocument): void {
    if (!workspace.getConfiguration("quarto.cells.diagnostics").get("enabled", true)) {
      return;
    }

    const docKey = document.uri.toString();
    const existingTimer = this.debounceTimers.get(docKey);
    if (existingTimer) clearTimeout(existingTimer);

    const debounceDelay = workspace.getConfiguration("quarto.cells.diagnostics").get("debounceDelay", 500);
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(docKey);
      await this.recreateVirtualDocs(document);
    }, debounceDelay);

    this.debounceTimers.set(docKey, timer);
  }

  private handleDocumentClose(document: TextDocument): void {
    const docKey = document.uri.toString();

    const timer = this.debounceTimers.get(docKey);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(docKey);
    }

    this.cleanupVirtualDocsForDocument(docKey);
    this.diagnosticCollection.delete(document.uri);
  }

  private cleanupVirtualDocsForDocument(docKey: string): void {
    for (const [vdocKey, vdocInfo] of this.vdocToReal.entries()) {
      if (vdocInfo.realDocUri.toString() === docKey) {
        vdocInfo.cleanup();
        this.vdocToReal.delete(vdocKey);
      }
    }
  }

  private async recreateVirtualDocs(document: TextDocument): Promise<void> {
    this.cleanupVirtualDocsForDocument(document.uri.toString());
    this.diagnosticCollection.delete(document.uri);
    await this.createVirtualDocs(document);
  }

  private async createVirtualDocs(document: TextDocument): Promise<void> {
    const tokens = this.engine.parse(document);

    // Group code blocks by language
    const languageMap = new Map<string, Token[]>();
    for (const token of tokens) {
      if (isExecutableLanguageBlock(token)) {
        const lang = languageNameFromBlock(token);
        if (lang) {
          const blocks = languageMap.get(lang) ?? [];
          blocks.push(token);
          languageMap.set(lang, blocks);
        }
      }
    }

    // Create one virtual doc per language
    for (const [langName] of languageMap) {
      const language = embeddedLanguage(langName);
      if (!language) continue;

      try {
        const vdocContent = this.createVirtualDocContent(document, tokens, language);

        await withVirtualDocUri(vdocContent, document.uri, "diagnostics", async (uri: Uri) => {
          this.outputChannel.debug(
            `[EmbeddedDiagnosticsManager] Created virtual document ${uri.toString()} ` +
            `for document ${document.uri.toString()} ` +
            `(language: ${langName})`
          );
          this.outputChannel.trace(
            `[EmbeddedDiagnosticsManager] Virtual document content:\n` +
            vdocContent.content
          );

          // Create a deferred promise.
          // It'll resolve when the vdoc info cleanup function is called
          // e.g. after we receive the vdoc's diagnostics.
          let resolve!: () => void;
          const promise = new Promise<void>((res) => resolve = res);

          this.vdocToReal.set(uri.toString(), {
            realDocUri: document.uri,
            tokens,
            cleanup: () => {
              this.outputChannel.debug(
                `[EmbeddedDiagnosticsManager] Cleaning up virtual document ${uri.toString()} ` +
                `for document ${document.uri.toString()}`
              );
              resolve();
            },
          });

          // Wait for the promise to resolve.
          // Once this callback ends, the virtual document will be cleaned up.
          this.outputChannel.debug(
            `[EmbeddedDiagnosticsManager] Waiting for diagnostics for virtual document ${uri.toString()} ` +
            `for document ${document.uri.toString()} `
          );
          await promise;
        });
      } catch (error) {
        this.outputChannel.error(`[EmbeddedDiagnosticsManager] Failed to create virtual document; for ${langName}:`, error);
      }
    }
  }

  // TODO: this maybe shouldn't be implemented here,
  //   this creates a virtual doc without the inject
  //   lines that i.e. in python disable linting like
  //  `# type: ignore`. We should co-locate this with
  //   where vdoc content is usually created in `virtualDocForCode`
  //   in vdoc.ts

  private createVirtualDocContent(
    document: TextDocument,
    tokens: Token[],
    language: EmbeddedLanguage
  ): VirtualDoc {
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push(language.emptyLine || "");
    }

    for (const block of tokens.filter(
      (token) => isExecutableLanguageBlock(token) && languageNameFromBlock(token) === language.ids[0]
    )) {
      for (let line = block.range.start.line + 1; line < block.range.end.line && line < document.lineCount; line++) {
        lines[line] = document.lineAt(line).text;
      }
    }

    return {
      language,
      content: lines.join("\n") + "\n",
    };
  }

  private handleDiagnosticsForVirtualDoc(uri: Uri, vdocInfo: VirtualDocInfo): void {
    const diagnostics = languages.getDiagnostics(uri);
    const mappedDiagnostics: Diagnostic[] = [];

    this.outputChannel.debug(
      `[EmbeddedDiagnosticsManager] Received $;{ diagnostics.length; } diagnostics for ` +
      ` ${vdocInfo.realDocUri.toString()} ` +
      ` (virtual doc: ${uri.toString()})`
    );

    for (const diagnostic of diagnostics) {
      const block = languageBlockAtPosition(vdocInfo.tokens, diagnostic.range.start);
      if (block) {
        mappedDiagnostics.push(new Diagnostic(diagnostic.range, diagnostic.message, diagnostic.severity));
      } else {
        this.outputChannel.error(
          `[EmbeddedDiagnosticsManager] Could not find language block; for diagnostic at ` +
          `[${diagnostic.range.start.line}, ${diagnostic.range.start.character}] ` +
          `in ${vdocInfo.realDocUri.toString()} ` +
          `(virtual doc: ${uri.toString()})`
        );
      }
    }

    this.diagnosticCollection.set(vdocInfo.realDocUri, mappedDiagnostics);

    // We have diagnostics, so we can clean up the virtual doc.
    // This ensures that the virtual doc's diagnostics don't show
    // in the problems pane (or only show momentarily).
    this.cleanupVirtualDocsForDocument(vdocInfo.realDocUri.toString());
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    for (const vdocInfo of this.vdocToReal.values()) {
      vdocInfo.cleanup();
    }
    this.vdocToReal.clear();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
