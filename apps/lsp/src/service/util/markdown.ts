/*
 * markdown.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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

import { Range, Position } from "vscode-languageserver";

import { PandocToken, isDisplayMath, kAttrClasses } from "quarto-core";

import { parseFrontMatterStr } from "quarto-core";
import { ITextDocument } from "../document";
import { IMdParser } from "../parser";

export function mathRange(parser: IMdParser, doc: ITextDocument, pos: Position) {
  // see if we are in a math block
  const tokens = parser.parsePandocTokens(doc);
  const mathBlock = tokens.find(isMathBlockAtPosition(pos));
  if (mathBlock) {
    return {
      math: (mathBlock.data as { text: string }).text,
      range: mathBlock.range,
    };
  }

  // see if we are in an inline range
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  return (
    inlineMathRange(pos, line, kInlineMathPattern) ||
    inlineMathRange(pos, line, kSingleLineDisplayMathPattern)
  );
}

export function isContentPosition(parser: IMdParser, doc: ITextDocument, pos: Position) {
  const tokens = parser.parsePandocTokens(doc);
  const codeBlock = tokens.find(isCodeBlockAtPosition(pos))
  return !codeBlock && !mathRange(parser, doc, pos);
}

export function documentFrontMatter(
  parser: IMdParser,
  doc: ITextDocument
): Record<string, unknown> {
  const tokens = parser.parsePandocTokens(doc);
  const yaml = tokens.find((token) => token.type === "FrontMatter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.data as string);
    if (frontMatter && typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export function isLatexPosition(parser: IMdParser, doc: ITextDocument, pos: Position) {
  // math is always latex
  if (mathRange(parser, doc, pos)) {
    return true;
  }
  //
  const tokens = parser.parsePandocTokens(doc);
  const codeBlock = tokens.find(isCodeBlockAtPosition(pos));
  if (codeBlock) {
    // code block is latex only if it's 'tex' or 'latex'
    return isLatexCodeBlock(codeBlock);
  } else {
    // non code block is latex
    return true;
  }
}

function isMathBlockAtPosition(pos: Position) {
  return (token: PandocToken) => {
    return isDisplayMath(token) && posIsWithinToken(pos, token);
  }
}

function isCodeBlockAtPosition(pos: Position) {
  return (token: PandocToken) => {
    return ["CodeBlock", "RawBlock"].includes(token.type) && posIsWithinToken(pos, token);
  } 
}

function posIsWithinToken(pos: Position, token: PandocToken) {
  return pos.line >= token.range.start.line && pos.line < token.range.end.line;
}

function isLatexCodeBlock(token: PandocToken) {
  const formats = ["tex", "latex"];
  if (token.type === "RawBlock") {
    const raw = token.data as { format: string, text: string };
    return formats.includes(raw.format);
  } else if (token.type === "CodeBlock") {
    return formats.includes(token.attr?.[kAttrClasses][0] || "");
  }
}

const kInlineMathPattern = /\$([^ ].*?[^ ]?)\$/g;
const kSingleLineDisplayMathPattern = /\$\$([^\n]+?)\$\$/;

function inlineMathRange(pos: Position, line: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  let match = pattern.exec(line);
  while (match) {
    const range = Range.create(
      Position.create(pos.line, match.index || 0),
      Position.create(pos.line, (match.index || 0) + match[0].length)
    );
    if (
      range.start.character <= pos.character &&
      range.end.character >= pos.character
    ) {
      return {
        math: match[1],
        range,
      };
    }
    match = pattern.exec(line);
  }
  return null;
}
