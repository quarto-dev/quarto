/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Range, Position } from "vscode-languageserver/node";

import Token from "markdown-it/lib/token";

import MarkdownIt from "markdown-it";
import { mathPlugin } from "../../shared/markdownit-math";
import { frontMatterPlugin } from "../../shared/markdownit-yaml";

import { TextDocument } from "vscode-languageserver-textdocument";
import { parseFrontMatterStr } from "../../shared/metadata";

export function mathRange(doc: TextDocument, pos: Position) {
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

  // see if we are in an inline range
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  return (
    inlineMathRange(pos, line, kInlineMathPattern) ||
    inlineMathRange(pos, line, kSingleLineDisplayMathPattern)
  );
}

export function isContentPosition(doc: TextDocument, pos: Position) {
  const tokens = markdownTokens.parse(doc);
  const codeBlock = tokens.find(isCodeBlockAtPosition(pos));
  return !codeBlock && !mathRange(doc, pos);
}

export function documentFrontMatter(
  doc: TextDocument
): Record<string, unknown> {
  const tokens = markdownTokens.parse(doc);
  const yaml = tokens.find((token) => token.type === "front_matter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.markup);
    if (typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

export function isLatexPosition(doc: TextDocument, pos: Position) {
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
      let [begin, end] = token.map;
      return pos.line >= begin && pos.line < end;
    } else {
      return false;
    }
  };
}

const kCodeBlockTokens = ["code", "fence", "html_block"];

class MarkdownTokens {
  public parse(document: TextDocument): Token[] {
    // create parser on demand
    if (!this.md_) {
      this.md_ = MarkdownIt("zero");
      this.md_.enable(kCodeBlockTokens);
      this.md_.use(mathPlugin, { enableInlines: false });
      this.md_.use(frontMatterPlugin);
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

const kInlineMathPattern = /\$([^ ].*?[^\ ]?)\$/;
const kSingleLineDisplayMathPattern = /\$\$([^\n]+?)\$\$/;

function inlineMathRange(pos: Position, line: string, pattern: RegExp) {
  const match = line.match(pattern);
  if (match) {
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
  }
  return null;
}
