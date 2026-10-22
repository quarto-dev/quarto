/*
 * language.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Position } from "../position";

import { Token, TokenCodeBlock, TokenMath, isCodeBlock, isMath, kAttrClasses  } from "./token";

export function isLanguageBlock(token: Token) {
  return isCodeBlock(token) || isDisplayMath(token);
}

// a language block that will be executed with its results
// inclued in the document (either by an engine or because
// it is a raw or display math block)
export function isExecutableLanguageBlock(token: Token) : token is TokenMath | TokenCodeBlock {
  if (isDisplayMath(token)) {
    return true;
  } else if (isCodeBlock(token) && token.attr?.[kAttrClasses].length) {
    const clz = token.attr?.[kAttrClasses][0];
    if (!clz) {
      return false;
    }
    return !!clz.match(/^\{=?([a-zA-Z0-9_-]+)(?: *[ ,].*?)?/);
  } else {
    return false;
  }
}

export function codeForExecutableLanguageBlock(
  token: TokenMath | TokenCodeBlock,
  appendNewline = true,
) {
  if (isMath(token)) {
    return token.data.text;
  } else if (isCodeBlock(token)) {
    return token.data + (appendNewline ? "\n" : "");
  } else {
    return "";
  }
}

export function languageBlockAtLine(
  tokens: Token[],
  line: number,
  includeFence = false
) {
  for (const languageBlock of tokens.filter(isExecutableLanguageBlock)) {
    let start = languageBlock.range.start.line;
    let end = languageBlock.range.end.line;
    if (!includeFence) {
      start++;
      end--;
    }
    if (line >= start && line <= end) {
      return languageBlock;
    }
  }
  return undefined;
}

export function languageBlockAtPosition(
  tokens: Token[],
  position: Position,
  includeFence = false
) {
  return languageBlockAtLine(tokens, position.line, includeFence);
}

export function isDisplayMath(token: Token): token is TokenMath {
  if (isMath(token)) {
    const math = token.data;
    return math.type === "DisplayMath";
  } else {
    return false;
  }
}

export function isDiagram(token: Token) : token is TokenCodeBlock {
  return (
    isExecutableLanguageBlockOf("mermaid")(token) ||
    isExecutableLanguageBlockOf("dot")(token)
  );
}

export function languageNameFromBlock(token: Token) {
  if (isDisplayMath(token)) {
    return "tex";
  } else if (isCodeBlock(token) && token.attr?.[kAttrClasses].length) {
    const match = token.attr?.[kAttrClasses][0].match(/^\{?=?([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1].split("-").pop() || "";
    } else {
      return "";
    }
  } else {
    return "";
  }
}

export function isExecutableLanguageBlockOf(language: string) {
  return (token: Token) : token is TokenMath | TokenCodeBlock => {
    return (
      isExecutableLanguageBlock(token) &&
      languageNameFromBlock(token) === language
    );
  };
}