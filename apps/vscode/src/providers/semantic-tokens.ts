/*
 * semantic-tokens.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
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
  CancellationToken,
  commands,
  Position,
  SemanticTokens,
  SemanticTokensBuilder,
  TextDocument,
  Uri,
  window,
} from "vscode";
import { DocumentSemanticsTokensSignature } from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { isQuartoDoc } from "../core/doc";
import {
  unadjustedSemanticTokens,
  virtualDocForLanguage,
  withVirtualDocUri,
  languageAtPosition,
  mainLanguage
} from "../vdoc/vdoc";
import { EmbeddedLanguage } from "../vdoc/languages";
import { QUARTO_SEMANTIC_TOKEN_LEGEND } from "quarto-utils";

/**
 * Decode semantic tokens from delta-encoded format to absolute positions
 *
 * Semantic tokens are encoded as [deltaLine, deltaStartChar, length, tokenType, tokenModifiers, ...]
 * This function converts them to absolute line/character positions for easier manipulation.
 */
export function decodeSemanticTokens(tokens: SemanticTokens): Array<{
  line: number;
  startChar: number;
  length: number;
  tokenType: number;
  tokenModifiers: number;
}> {
  const decoded: Array<{
    line: number;
    startChar: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
  }> = [];

  let currentLine = 0;
  let currentChar = 0;

  for (let i = 0; i < tokens.data.length; i += 5) {
    const deltaLine = tokens.data[i];
    const deltaStartChar = tokens.data[i + 1];
    const length = tokens.data[i + 2];
    const tokenType = tokens.data[i + 3];
    const tokenModifiers = tokens.data[i + 4];

    // Update absolute position
    currentLine += deltaLine;
    if (deltaLine > 0) {
      currentChar = deltaStartChar;
    } else {
      currentChar += deltaStartChar;
    }

    decoded.push({
      line: currentLine,
      startChar: currentChar,
      length,
      tokenType,
      tokenModifiers
    });
  }

  return decoded;
}

/**
 * Encode semantic tokens from absolute positions to delta-encoded format
 *
 * Uses VS Code's built-in SemanticTokensBuilder for proper delta encoding.
 */
export function encodeSemanticTokens(
  tokens: Array<{
    line: number;
    startChar: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
  }>,
  resultId?: string
): SemanticTokens {
  const builder = new SemanticTokensBuilder();

  for (const token of tokens) {
    builder.push(
      token.line,
      token.startChar,
      token.length,
      token.tokenType,
      token.tokenModifiers
    );
  }

  return builder.build(resultId);
}

/**
 * Build a map from source type/modifier names to target indices
 */
function buildLegendMap(
  sourceNames: string[],
  targetNames: string[]
): Map<number, number> {
  const map = new Map<number, number>();

  for (let i = 0; i < sourceNames.length; i++) {
    const targetIndex = targetNames.indexOf(sourceNames[i]);
    if (targetIndex >= 0) {
      map.set(i, targetIndex);
    }
  }

  return map;
}

/**
 * Remap a modifier bitfield from source indices to target indices
 */
function remapModifierBitfield(
  sourceModifiers: number,
  modifierMap: Map<number, number>
): number {
  let targetModifiers = 0;

  // Check each bit in the source bitfield
  for (const [sourceBit, targetBit] of modifierMap) {
    if (sourceModifiers & (1 << sourceBit)) {
      targetModifiers |= (1 << targetBit);
    }
  }

  return targetModifiers;
}

/**
 * Remap token type/modifier indices from source legend to target legend
 * Only maps types that exist in both legends (standard types only)
 */
function remapTokenIndices(
  tokens: SemanticTokens,
  sourceLegend: { tokenTypes: string[]; tokenModifiers: string[]; },
  targetLegend: { tokenTypes: string[]; tokenModifiers: string[]; }
): SemanticTokens {
  // Build mappings once
  const typeMap = buildLegendMap(sourceLegend.tokenTypes, targetLegend.tokenTypes);
  const modifierMap = buildLegendMap(sourceLegend.tokenModifiers, targetLegend.tokenModifiers);

  // Decode, filter, and remap tokens
  const decoded = decodeSemanticTokens(tokens);
  const remapped = decoded
    .filter(token => typeMap.has(token.tokenType))
    .map(token => ({
      ...token,
      tokenType: typeMap.get(token.tokenType)!,
      tokenModifiers: remapModifierBitfield(token.tokenModifiers, modifierMap)
    }));

  return encodeSemanticTokens(remapped, tokens.resultId);
}

export function embeddedSemanticTokensProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    token: CancellationToken,
    next: DocumentSemanticsTokensSignature
  ): Promise<SemanticTokens | null | undefined> => {
    // Only handle Quarto documents
    if (!isQuartoDoc(document, true)) {
      return await next(document, token);
    }

    // Ensure we are dealing with the active document
    const editor = window.activeTextEditor;
    const activeDocument = editor?.document;
    if (!editor || activeDocument?.uri.toString() !== document.uri.toString()) {
      // Not the active document, delegate to default
      return await next(document, token);
    }

    // Parse the document to get all tokens
    const tokens = engine.parse(document);

    // Try to find language at cursor position, otherwise use main language
    const line = editor.selection.active.line;
    const position = new Position(line, 0);
    let language = languageAtPosition(tokens, position);
    if (!language) {
      language = mainLanguage(tokens);
    }

    if (!language) {
      // No language found, delegate to default
      return await next(document, token);
    }

    // Create virtual doc for all blocks of this language
    const vdoc = virtualDocForLanguage(document, tokens, language);

    return await withVirtualDocUri(vdoc, document.uri, "semanticTokens", async (uri: Uri) => {
      try {
        // Get the legend from the embedded language provider
        const legend = await commands.executeCommand<any>(
          "vscode.provideDocumentSemanticTokensLegend",
          uri
        );

        const tokens = await commands.executeCommand<SemanticTokens>(
          "vscode.provideDocumentSemanticTokens",
          uri
        );

        if (!tokens || tokens.data.length === 0) {
          return tokens;
        }

        // Remap token indices from embedded provider's legend to our universal legend
        let remappedTokens = tokens;
        if (legend) {
          remappedTokens = remapTokenIndices(tokens, legend, QUARTO_SEMANTIC_TOKEN_LEGEND);
        }

        // Adjust token positions from virtual doc to real doc coordinates
        return unadjustedSemanticTokens(vdoc.language, remappedTokens);
      } catch (error) {
        return undefined;
      }
    });
  };
}
