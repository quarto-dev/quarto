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
import { VirtualDoc } from "../vdoc/vdoc";
import * as fs from "fs";
import * as path from "path";
import * as uuid from "uuid";
import { isQuartoDoc } from "../core/doc";

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

  constructor(private engine: MarkdownEngine) {
    this.diagnosticCollection = languages.createDiagnosticCollection("quarto-embedded");
    this.disposables.push(this.diagnosticCollection);

    // Clean up any leftover virtual docs from previous session
    this.cleanupAllVirtualDocs();

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

  private async cleanupAllVirtualDocs(): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) return;

    for (const folder of workspaceFolders) {
      try {
        const quartoDir = Uri.joinPath(folder.uri, ".quarto");
        const files = await workspace.fs.readDirectory(quartoDir);

        for (const [filename, fileType] of files) {
          if (fileType === 1 && filename.startsWith(".vdoc.")) {
            await workspace.fs.delete(Uri.joinPath(quartoDir, filename), { useTrash: false });
          }
        }
      } catch {
        // Directory doesn't exist, that's fine
      }
    }
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
    this.createVirtualDocs(document);
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
        const { uri, cleanup } = await this.writeVirtualDocFile(vdocContent, document.uri, language);

        this.vdocToReal.set(uri.toString(), {
          realDocUri: document.uri,
          tokens,
          cleanup,
        });
      } catch (error) {
        console.debug(`Failed to create virtual doc for ${langName}:`, error);
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

  // creates a virtual doc in the workspace under a `.quarto` folder.
  // This probably isn't a good user experience,
  // but its how I got it to work for now (LSPs don't seem to
  // want to give diagnostics for files that aren't in the workspace).
  private async writeVirtualDocFile(
    vdocContent: VirtualDoc,
    documentUri: Uri,
    language: EmbeddedLanguage
  ): Promise<{ uri: Uri; cleanup: () => void; }> {
    const docDir = path.dirname(documentUri.fsPath);
    const quartoDir = path.join(docDir, ".quarto");

    if (!fs.existsSync(quartoDir)) {
      fs.mkdirSync(quartoDir, { recursive: true });
    }

    const filename = `.vdoc.${uuid.v4()}.${language.extension}`;
    const filepath = path.join(quartoDir, filename);

    fs.writeFileSync(filepath, vdocContent.content);

    const uri = Uri.file(filepath);
    const doc = await workspace.openTextDocument(uri);

    return {
      uri,
      cleanup: async () => {
        try {
          // First set the language to 'raw' so that the language client
          // closes the text document in the language server, which clears
          // diagnostics for the file. This stops diagnostics from building
          // up even after virtual docs are cleaned up.
          await languages.setTextDocumentLanguage(doc, "raw");

          await workspace.fs.delete(uri, { useTrash: false });
        } catch (error) {
          console.debug(`Failed to delete virtual doc: ${filepath}`, error);
        }
      }
    };
  }

  private handleDiagnosticsForVirtualDoc(uri: Uri, vdocInfo: VirtualDocInfo): void {
    const diagnostics = languages.getDiagnostics(uri);
    const mappedDiagnostics: Diagnostic[] = [];

    for (const diagnostic of diagnostics) {
      const block = languageBlockAtPosition(vdocInfo.tokens, diagnostic.range.start);
      if (block) {
        mappedDiagnostics.push(new Diagnostic(diagnostic.range, diagnostic.message, diagnostic.severity));
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

    this.cleanupAllVirtualDocs();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
