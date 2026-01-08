/*
 * semantic-tokens-legend.ts
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

/**
 * Semantic token legend for Quarto documents
 *
 * Based on standard VS Code semantic token types and modifiers:
 * https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide#standard-token-types-and-modifiers
 *
 * This legend is used by both the LSP server (to advertise capabilities)
 * and the VS Code extension (to remap tokens from embedded language providers)
 */
export const QUARTO_SEMANTIC_TOKEN_LEGEND = {
  tokenTypes: [
    'namespace', 'class', 'enum', 'interface', 'struct',
    'typeParameter', 'type', 'parameter', 'variable', 'property',
    'enumMember', 'decorator', 'event', 'function', 'method',
    'macro', 'label', 'comment', 'string', 'keyword',
    'number', 'regexp', 'operator',
    // Commonly used by language servers, widely supported by themes
    'module'
  ],
  tokenModifiers: [
    'declaration', 'definition', 'readonly', 'static', 'deprecated',
    'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'
  ]
};
