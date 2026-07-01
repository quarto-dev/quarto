/*
 * semantic-tokens-legend.ts
 *
 * Copyright (C) 2025-2026 by Posit Software, PBC
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
