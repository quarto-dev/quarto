/*
 * count.ts
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

import { wordBreaker } from "core";
import {
  Token,
  TokenHeader,
  isCodeBlock,
  isFrontMatter,
  isHeader,
  isMath,
  isRawBlock,
  markdownToText,
} from "quarto-core";

export interface WordCountOptions {
  // when true, code cells / fenced code / raw blocks are counted as words
  // (YAML front matter and display math are always excluded)
  includeCodeCells: boolean;
}

export interface SectionWordCount {
  // 0-based line of the heading
  line: number;
  level: number;
  words: number;
}

const wb = wordBreaker();

/**
 * Count the prose words in an entire document.
 */
export function countDocument(
  tokens: Token[],
  text: string,
  options: WordCountOptions
): number {
  const lines = splitLines(text);
  const excluded = excludedLines(tokens, lines.length, options);
  return countLines(lines, excluded, 0, lines.length - 1);
}

/**
 * Count the prose words in an arbitrary span of markdown text (e.g. the current
 * selection). Inline markup is reduced to plain text before counting.
 * When options are provided, fenced code blocks and display math are stripped
 * according to the same rules as countDocument/countSections.
 */
export function countText(text: string, options?: WordCountOptions): number {
  if (!text) {
    return 0;
  }
  let processed = text;
  if (options && !options.includeCodeCells) {
    // strip fenced code blocks (executable or plain) and display math before counting
    processed = processed
      .replace(/^```[\s\S]*?^```[ \t]*$/gm, "")
      .replace(/^\$\$[\s\S]*?^\$\$[ \t]*$/gm, "");
  }
  // collapse line breaks to spaces first (see countLines)
  return wb.breakWords(markdownToText(processed.replace(/\r\n|\n|\r/g, " "))).length;
}

/**
 * Count the prose words in a line range of a document, using the token list
 * to apply the same code-block exclusion logic as countDocument.
 * startLine and endLine are 0-based, inclusive.
 */
export function countSelectionLines(
  tokens: Token[],
  text: string,
  startLine: number,
  endLine: number,
  options: WordCountOptions
): number {
  const lines = splitLines(text);
  const excluded = excludedLines(tokens, lines.length, options);
  return countLines(lines, excluded, startLine, endLine);
}

/**
 * Count the prose words in each section subtree. A section runs from its heading
 * to the next heading of equal-or-higher level and includes nested content and
 * nested sub-headings, but excludes the section's own heading text.
 */
export function countSections(
  tokens: Token[],
  text: string,
  options: WordCountOptions
): SectionWordCount[] {
  const lines = splitLines(text);
  const excluded = excludedLines(tokens, lines.length, options);

  const headers = tokens.filter(isHeader) as TokenHeader[];
  return headers.map((header, i) => {
    const headerLine = header.range.start.line;
    const level = header.data.level;

    // section ends just before the next heading of equal-or-higher level
    let endLine = lines.length - 1;
    for (let j = i + 1; j < headers.length; j++) {
      if (headers[j].data.level <= level) {
        endLine = headers[j].range.start.line - 1;
        break;
      }
    }

    return {
      line: headerLine,
      level,
      words: countLines(lines, excluded, header.range.end.line + 1, endLine),
    };
  });
}

function countLines(
  lines: string[],
  excluded: boolean[],
  fromLine: number,
  toLine: number
): number {
  if (toLine < fromLine) {
    return 0;
  }
  const prose: string[] = [];
  for (let line = fromLine; line <= toLine && line < lines.length; line++) {
    if (!excluded[line]) {
      prose.push(lines[line]);
    }
  }
  if (prose.length === 0) {
    return 0;
  }
  // join with spaces (not newlines) so that words on adjacent lines stay
  // separate: the inline parser collapses soft line breaks, which would
  // otherwise merge the last/first words of consecutive lines into one
  const text = markdownToText(prose.join(" "));
  return wb.breakWords(text).length;
}

// compute the set of lines that should not contribute to the word count
function excludedLines(
  tokens: Token[],
  lineCount: number,
  options: WordCountOptions
): boolean[] {
  const excluded = new Array<boolean>(lineCount).fill(false);
  const exclude = (token: Token) => {
    for (
      let line = token.range.start.line;
      line <= token.range.end.line && line < lineCount;
      line++
    ) {
      excluded[line] = true;
    }
  };
  for (const token of tokens) {
    if (isFrontMatter(token) || isMath(token)) {
      // YAML front matter and display math never count as prose
      exclude(token);
    } else if (!options.includeCodeCells && (isCodeBlock(token) || isRawBlock(token))) {
      exclude(token);
    }
  }
  return excluded;
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}
