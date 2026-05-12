/*
 * vdoc.ts
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
/* eslint-disable @typescript-eslint/naming-convention */

import { Position, TextDocument, Uri, Range, SemanticTokens, extensions, workspace } from "vscode";
import { Token, isExecutableLanguageBlock, languageBlockAtPosition, languageNameFromBlock } from "quarto-core";

import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { embeddedLanguage, EmbeddedLanguage } from "./languages";
import { virtualDocUriFromEmbeddedContent } from "./vdoc-content";
import { virtualDocUriFromTempFile } from "./vdoc-tempfile";
import { decodeSemanticTokens, encodeSemanticTokens } from "../providers/semantic-tokens";

export interface VirtualDoc {
  language: EmbeddedLanguage;
  content: string;
}

export enum VirtualDocStyle {
  /** Every block corresponding to the current position's language */
  Language,

  /** Only the block corresponding to the current position */
  Block
}

export async function virtualDoc(
  document: TextDocument,
  position: Position,
  engine: MarkdownEngine,
  style = VirtualDocStyle.Language
): Promise<VirtualDoc | undefined> {
  // make sure this is a quarto doc
  if (!isQuartoDoc(document)) {
    return undefined;
  }

  // check if the cursor is in a fenced code block
  const tokens = engine.parse(document);

  const block = languageBlockAtPosition(tokens, position);
  if (!block) {
    return undefined;
  }

  const language = languageFromBlock(block);
  if (!language) {
    return undefined;
  }

  switch (style) {
    case VirtualDocStyle.Language: {
      return virtualDocForLanguage(document, tokens, language);
    }
    case VirtualDocStyle.Block: {
      return virtualDocForBlock(document, block, language);
    }
    default: {
      // Should be unreachable
      return undefined;
    }
  }
}

function virtualDocForBlock(document: TextDocument, block: Token, language: EmbeddedLanguage) {
  const lines = linesForLanguage(document, language);
  fillLinesFromBlock(lines, document, block);
  padLinesForLanguage(lines, language);
  return virtualDocForCode(lines, language);
}

/**
 * Create a virtual document from a text document.
 *
 * @param document The text document to create a virtual document from
 * @param language The language of the virtual document
 * @param action The action for which the virtual document is being created, if known
 */
export function virtualDocForLanguage(
  document: TextDocument,
  tokens: Token[],
  language: EmbeddedLanguage,
  action?: VirtualDocAction,
): VirtualDoc {
  const lines = linesForLanguage(document, language);
  for (const languageBlock of tokens.filter(isBlockOfLanguage(language))) {
    fillLinesFromBlock(lines, document, languageBlock);
  }
  padLinesForLanguage(lines, language);
  return virtualDocForCode(lines, language, action);
}

function linesForLanguage(document: TextDocument, language: EmbeddedLanguage) {
  const lines: string[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    lines.push(language.emptyLine || "");
  }
  return lines;
}

function fillLinesFromBlock(lines: string[], document: TextDocument, block: Token) {
  for (
    let line = block.range.start.line + 1;
    line < block.range.end.line && line < document.lineCount;
    line++
  ) {
    lines[line] = document.lineAt(line).text;
  }
}

function padLinesForLanguage(lines: string[], language: EmbeddedLanguage) {
  for (let i = 0; i < 2; i++) {
    lines.push(language.emptyLine || "");
  }
}

/**
 * Create a virtual document from code and language.
 *
 * @param code The lines of code to include in the virtual document
 * @param language The language of the virtual document
 * @param action The action for which the virtual document is being created, if known
 */
export function virtualDocForCode(
  code: string[],
  language: EmbeddedLanguage,
  action?: VirtualDocAction,
) {

  const lines = [...code];

  // For non-diagnostic actions, inject lines of code to disable diagnostics.
  if (language.inject && action !== "diagnostics") {
    lines.unshift(...language.inject);
  }

  return {
    language,
    content: lines.join("\n") + "\n",
  };
}

export type VirtualDocAction =
  "completion" |
  "hover" |
  "signature" |
  "definition" |
  "format" |
  "statementRange" |
  "helpTopic" |
  "executeSelectionAtPositionInteractive" |
  "semanticTokens" |
  "diagnostics";

export type VirtualDocUri = { uri: Uri, cleanup?: () => Promise<void>; };

/**
 * Execute a callback on a virtual document's temporary URI
 *
 * This method automatically cleans up the temporary URI after executing `f`.
 *
 * @param vdoc The virtual document to create a temporary URI for
 * @param parentUri The virtual document's original URI it was virtualized from
 * @param f The callback to execute
 * @returns A Promise evaluating to an object of type `T` returned by `f`
 */
export async function withVirtualDocUri<T>(
  vdoc: VirtualDoc,
  parentUri: Uri,
  action: VirtualDocAction,
  f: (uri: Uri) => Promise<T>
): Promise<T> {
  const vdocUri = await virtualDocUri(vdoc, parentUri, action);

  // try-finally without a catch allows `f()` to propagate an exception up to the caller
  // while still allowing us to clean up the vdoc tempfile.
  try {
    return await f(vdocUri.uri);
  } finally {
    if (vdocUri.cleanup) {
      vdocUri.cleanup();
    }
  }
}

/**
 * Whether to use a local temporary file for a given virtual document and action.
 */
function shouldUseLocalTempFile(virtualDoc: VirtualDoc, action: VirtualDocAction): boolean {
  // Format and definition actions use a transient local vdoc
  // (so they can get project-specific paths and formatting config)
  if (["format", "definition"].includes(action)) {
    return true;
  }

  // The vscode-R extension uses the languageserver R package
  // which does not provide diagnostics for temp files.
  // Use a local temp file in that case.
  if (
    virtualDoc.language.ids.includes("r") &&
    action === "diagnostics" &&
    extensions.getExtension("REditorSupport.r")?.isActive
  ) {
    const rLspConfig = workspace.getConfiguration("r.lsp");
    if (
      rLspConfig.get<boolean>("enabled", false) &&
      rLspConfig.get<boolean>("diagnostics", false)
    ) {
      return true;
    }
  }

  // Default to a non-local temp file - it's less invasive
  return false;
}

// To be used through `withVirtualDocUri()`. Not safe to export on its own! The
// cleanup hook must be called, and relying on the caller to do this is a huge
// footgun.
async function virtualDocUri(
  virtualDoc: VirtualDoc,
  parentUri: Uri,
  action: VirtualDocAction
): Promise<VirtualDocUri> {

  const local = shouldUseLocalTempFile(virtualDoc, action);

  return virtualDoc.language.type === "content"
    ? { uri: virtualDocUriFromEmbeddedContent(virtualDoc, parentUri) }
    : await virtualDocUriFromTempFile(virtualDoc, parentUri.fsPath, local);
}

export function languageAtPosition(tokens: Token[], position: Position) {
  const block = languageBlockAtPosition(tokens, position);
  if (block) {
    return languageFromBlock(block);
  } else {
    return undefined;
  }
}

/** Get all languages with code blocks in a token stream. */
export function allLanguages(tokens: Token[]): EmbeddedLanguage[] {
  const names = new Set(
    tokens.filter(isExecutableLanguageBlock)
      .map(languageNameFromBlock)
      .filter(Boolean)
  );
  return [...names]
    .map(embeddedLanguage)
    .filter((l): l is EmbeddedLanguage => l !== undefined);
}

export function mainLanguage(
  tokens: Token[],
  filter?: (language: EmbeddedLanguage) => boolean
): EmbeddedLanguage | undefined {
  const languages: Record<string, number> = {};
  tokens.filter(isExecutableLanguageBlock).forEach((token) => {
    const embeddedLanguage = languageFromBlock(token);
    if (
      embeddedLanguage !== undefined &&
      (!filter || filter(embeddedLanguage))
    ) {
      const language = languageNameFromBlock(token);
      languages[language] = languages[language] ? languages[language] + 1 : 1;
    }
  });
  const languageName = Object.keys(languages).sort(
    (a, b) => languages[b] - languages[a]
  )[0];
  if (languageName) {
    return embeddedLanguage(languageName);
  } else {
    return undefined;
  }
}

export function languageFromBlock(token: Token) {
  const name = languageNameFromBlock(token);
  return embeddedLanguage(name);
}

export function isBlockOfLanguage(language: EmbeddedLanguage) {
  return (token: Token) => {
    return (
      isExecutableLanguageBlock(token) &&
      languageFromBlock(token)?.ids.some((id) => language.ids.includes(id))
    );
  };
}

// adjust line for inject
export function adjustedLine(language: EmbeddedLanguage, line: number): number {
  return line + (language.inject?.length || 0);
}

export function unadjustedLine(language: EmbeddedLanguage, line: number): number {
  return line - (language.inject?.length || 0);
}

export function adjustedPosition(language: EmbeddedLanguage, pos: Position) {
  return new Position(adjustedLine(language, pos.line), pos.character);
}

export function unadjustedPosition(language: EmbeddedLanguage, pos: Position) {
  return new Position(unadjustedLine(language, pos.line), pos.character);
}

export function unadjustedRange(language: EmbeddedLanguage, range: Range) {
  return new Range(
    unadjustedPosition(language, range.start),
    unadjustedPosition(language, range.end)
  );
}

/**
 * Adjust semantic tokens from virtual document coordinates to real document coordinates
 *
 * This function decodes the tokens, adjusts each token's position using unadjustedRange,
 * and re-encodes them back to delta format.
 */
export function unadjustedSemanticTokens(
  language: EmbeddedLanguage,
  tokens: SemanticTokens
): SemanticTokens {
  // Decode tokens to absolute positions
  const decoded = decodeSemanticTokens(tokens);

  // Adjust each token's position
  const adjusted = decoded.map(t => {
    const range = unadjustedRange(language, new Range(
      new Position(t.line, t.startChar),
      new Position(t.line, t.startChar + t.length)
    ));
    return {
      line: range.start.line,
      startChar: range.start.character,
      length: range.end.character - range.start.character,
      tokenType: t.tokenType,
      tokenModifiers: t.tokenModifiers
    };
  });

  // Re-encode to delta format
  return encodeSemanticTokens(adjusted, tokens.resultId);
}
