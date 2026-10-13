/*
 * workspace.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Helpers for running the language service over in-memory documents.
 */

import { Emitter, TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI, Utils } from "vscode-uri";

import { Document, markdownitParser } from "quarto-core";

import { Logger } from "../src/logging";
import { createLanguageService, IWorkspace } from "../src/service";
import { Quarto } from "../src/quarto";
import { defaultLsConfiguration } from "../src/service/config";

export const logger = new Logger(() => { /* quiet */ });

export const root = URI.file("/project");

// A Quarto document at `name` (relative to `root`) with the given lines.
export function qmd(name: string, lines: string[]): TextDocument {
  return TextDocument.create(Utils.joinPath(root, name).toString(), "quarto", 1, lines.join("\n"));
}

// Minimal in-memory workspace holding the given documents.
export function memoryWorkspace(docs: Document[]): IWorkspace {
  const byUri = new Map(docs.map(doc => [doc.uri, doc]));
  return {
    workspaceFolders: [root],
    onDidChangeMarkdownDocument: new Emitter<Document>().event,
    onDidCreateMarkdownDocument: new Emitter<Document>().event,
    onDidDeleteMarkdownDocument: new Emitter<URI>().event,
    getAllMarkdownDocuments: async () => docs,
    hasMarkdownDocument: (resource: URI) => byUri.has(resource.toString()),
    openMarkdownDocument: async (resource: URI) => byUri.get(resource.toString()),
    stat: async (resource: URI) => byUri.has(resource.toString()) ? { isDirectory: false } : undefined,
    readDirectory: async () => [],
  };
}

// A language service over an in-memory workspace holding the given documents.
export function memoryLanguageService(docs: Document[]) {
  return createLanguageService({
    config: defaultLsConfiguration(),
    quarto: {} as Quarto,
    workspace: memoryWorkspace(docs),
    documents: new TextDocuments(TextDocument),
    parser: markdownitParser(),
    logger,
  });
}
