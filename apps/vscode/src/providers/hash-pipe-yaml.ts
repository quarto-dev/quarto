/*
 * hash-pipe-yaml.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import * as vscode from "vscode";
import { parseDocument, visit } from "yaml";

import { isExecutableLanguageBlock } from "quarto-core";

import { kQuartoDocSelector } from "../core/doc";
import { vscRange } from "../core/range";
import { MarkdownEngine } from "../markdown/engine";

// token types are mapped to the same textmate scopes used by source.yaml
// (see semanticTokenScopes in package.json) so that cell options pick up
// the theme's yaml frontmatter colors
const kTokenTypes = [
  "quartoYamlKey",
  "quartoYamlString",
  "quartoYamlNumber",
  "quartoYamlBoolean",
  "quartoYamlNull",
] as const;
export type HashPipeTokenType = (typeof kTokenTypes)[number];

const kLegend = new vscode.SemanticTokensLegend([...kTokenTypes]);

// a single semantic token for yaml in cell options (absolute position)
export interface HashPipeYamlToken {
  line: number;
  startChar: number;
  length: number;
  tokenType: HashPipeTokenType;
}

export function activateHashPipeYamlHighlighter(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      kQuartoDocSelector,
      new HashPipeYamlTokensProvider(engine),
      kLegend
    )
  );
}

// compute yaml semantic tokens for the cell options (#| comments) of all
// executable blocks in a document (also used by the embedded semantic
// tokens middleware, which merges these with embedded language tokens)
export function hashPipeYamlTokens(
  engine: MarkdownEngine,
  document: vscode.TextDocument
): HashPipeYamlToken[] {
  const yamlTokens: HashPipeYamlToken[] = [];
  const tokens = engine.parse(document);
  for (const block of tokens.filter(isExecutableLanguageBlock)) {
    const { lines, source } = hashPipeYaml(document, vscRange(block.range));
    if (lines.length > 0) {
      emitYamlTokens(source, lines, yamlTokens);
    }
  }
  return yamlTokens;
}

// a single #| line: where its yaml content lives within the assembled
// yaml source, and where that content starts in the document
export interface HashPipeLine {
  yamlStart: number;
  yamlEnd: number;
  docLine: number;
  docCharBase: number;
}

class HashPipeYamlTokensProvider
  implements vscode.DocumentSemanticTokensProvider {
  constructor(private readonly engine_: MarkdownEngine) { }

  public provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(kLegend);
    const yamlTokens = hashPipeYamlTokens(this.engine_, document);
    for (const token of yamlTokens) {
      builder.push(
        new vscode.Range(
          token.line,
          token.startChar,
          token.line,
          token.startChar + token.length
        ),
        token.tokenType
      );
    }
    return builder.build();
  }
}

// collect the leading run of #| lines in a cell and assemble their
// content into a single yaml source string
//
// note: this only handles #-comment languages (r, python, julia, etc.).
// to generalize to all languages (//| for js, --| for sql, /*| ... */
// for c, etc.), derive the prefix from the block's language using
// kLangCommentChars/optionCommentPattern in packages/core/src/jupyter/options.ts
export function hashPipeYaml(
  document: vscode.TextDocument,
  blockRange: vscode.Range
) {
  const lines: HashPipeLine[] = [];
  let source = "";
  const lastLine = Math.min(blockRange.end.line, document.lineCount - 1);
  for (let i = blockRange.start.line + 1; i <= lastLine; i++) {
    const text = document.lineAt(i).text;
    const match = text.match(/^\s*#\|/);
    if (!match) {
      break;
    }
    const content = text.slice(match[0].length);
    lines.push({
      yamlStart: source.length,
      yamlEnd: source.length + content.length,
      docLine: i,
      docCharBase: match[0].length,
    });
    source += content + "\n";
  }
  return { lines, source };
}

function emitYamlTokens(
  source: string,
  lines: HashPipeLine[],
  yamlTokens: HashPipeYamlToken[]
) {
  const yaml = parseDocument(source);
  visit(yaml, {
    Scalar: (key, node) => {
      if (node.range) {
        const type: HashPipeTokenType =
          key === "key" ? "quartoYamlKey" : scalarTokenType(node.value);
        pushTokens(lines, node.range[0], node.range[1], type, yamlTokens);
      }
    },
  });
}

function scalarTokenType(value: unknown): HashPipeTokenType {
  switch (typeof value) {
    case "number":
    case "bigint":
      return "quartoYamlNumber";
    case "boolean":
      return "quartoYamlBoolean";
    default:
      return value === null ? "quartoYamlNull" : "quartoYamlString";
  }
}

// map a [start, end) range in the yaml source back to document positions,
// splitting across lines (e.g. for block scalars)
function pushTokens(
  lines: HashPipeLine[],
  start: number,
  end: number,
  tokenType: HashPipeTokenType,
  yamlTokens: HashPipeYamlToken[]
) {
  for (const line of lines) {
    const tokenStart = Math.max(start, line.yamlStart);
    const tokenEnd = Math.min(end, line.yamlEnd);
    if (tokenStart < tokenEnd) {
      yamlTokens.push({
        line: line.docLine,
        startChar: line.docCharBase + (tokenStart - line.yamlStart),
        length: tokenEnd - tokenStart,
        tokenType,
      });
    }
  }
}
