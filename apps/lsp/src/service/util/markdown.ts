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

import Token from "markdown-it/lib/token";

import MarkdownIt from "markdown-it";
import { markdownitFrontMatterPlugin, markdownitMathPlugin } from "quarto-core";

import { parseFrontMatterStr } from "quarto-core";
import { lines } from "core";
import { ITextDocument } from "../document";

export function mathRange(doc: ITextDocument, pos: Position) {
  // see if we are in a math block
  const tokens = markdownTokens.parse(doc);
  const mathBlock = tokens.find(isMathBlockAtPosition(pos));
  if (mathBlock && mathBlock.map) {
    return {
      math: mathBlock.content,
      range: Range.create(
        Position.create(mathBlock.map[0], 0),
        Position.create(mathBlock.map[1] + 1, 0)
      ),
    };
  }

  // markdown-it can't see math blocks in lists if they are 
  // indented 4 spaces, so attempt to parse math out of 
  // non-fenced "code_block"
  const codeBlock = tokens.find(isBlockTypeAtPosition(["code_block"], pos));
  if (codeBlock && codeBlock.map) {
    const codeBlockLines = lines(codeBlock.content.trim());
    let codeBegin: number | undefined;
    for (let i=0; i<codeBlockLines.length; i++) {
      const line = codeBlockLines[i];
      if (line.startsWith("$$")) {
        if (codeBegin !== undefined) {
          // ensure we have at least one "\" to indicate this is math
          const math = codeBlockLines.slice(1 + codeBegin, i).join("\n");
          if (math.includes("\\")) {
            return {
              math,
              range: Range.create(
                Position.create(codeBlock.map[0] + codeBegin, 0),
                Position.create(codeBlock.map[0] + i + 1, 0)
              ),
            };
          } else {
            codeBegin = undefined; // not math, reset
          }
          
        } else {
          codeBegin = i;
        }
      }
    }
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

export function isContentPosition(doc: ITextDocument, pos: Position) {
  const tokens = markdownTokens.parse(doc);
  const codeBlock = tokens.find(isCodeBlockAtPosition(pos));
  return !codeBlock && !mathRange(doc, pos);
}

export function documentFrontMatter(
  doc: ITextDocument
): Record<string, unknown> {
  const tokens = markdownTokens.parse(doc);
  const yaml = tokens.find((token) => token.type === "front_matter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.markup);
    if (frontMatter && typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export function isLatexPosition(doc: ITextDocument, pos: Position) {
  // math is always latex
  if (mathRange(doc, pos)) {
    return true;
  }
  //
  const tokens = markdownTokens.parse(doc);
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
  return isBlockTypeAtPosition(["math_block"], pos);
}

export function isCodeBlockAtPosition(pos: Position) {
  return isBlockTypeAtPosition(kCodeBlockTokens, pos);
}

export function isLatexCodeBlock(token: Token) {
  return (
    !!token.info &&
    ["tex", "latex"].includes(
      token.info.replace(/^[^\w]*/, "").replace(/[^\w]$/, "")
    )
  );
}

function isBlockTypeAtPosition(types: string[], pos: Position) {
  return (token: Token) => {
    if (types.includes(token.type) && token.map) {
      const [begin, end] = token.map;
      return pos.line >= begin && pos.line < end;
    } else {
      return false;
    }
  };
}

const kCodeBlockTokens = ["code", "fence", "html_block"];

class MarkdownTokens {
  public parse(document: ITextDocument): Token[] {
    // create parser on demand
    if (!this.md_) {
      this.md_ = MarkdownIt("zero");
      this.md_.enable(kCodeBlockTokens);
      this.md_.use(markdownitMathPlugin, { enableInlines: false });
      this.md_.use(markdownitFrontMatterPlugin);
    }

    // (re)-primte cache if required
    if (
      !this.cachedTokens_ ||
      this.cachedUri_ !== document.uri.toString() ||
      this.cachedVersion_ !== document.version
    ) {
      this.cachedUri_ = document.uri.toString();
      this.cachedVersion_ = document.version;
      this.cachedTokens_ = this.md_.parse(document.getText(), {});
    }

    return this.cachedTokens_!;
  }

  private md_: MarkdownIt | undefined;
  private cachedUri_: string | undefined;
  private cachedVersion_: number | undefined;
  private cachedTokens_: Token[] | undefined;
}

const markdownTokens = new MarkdownTokens();

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
