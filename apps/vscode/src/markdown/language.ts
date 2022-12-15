/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Position } from "vscode";

import Token from "markdown-it/lib/token";

export function isLanguageBlock(token: Token) {
  return isFencedCode(token) || isDisplayMath(token);
}

// a language block that will be executed with its results
// inclued in the document (either by an engine or because
// it is a raw or display math block)
export function isExecutableLanguageBlock(token: Token) {
  return (
    (isFencedCode(token) &&
      token.info.match(/^\{=?([a-zA-Z0-9_\-]+)(?: *[ ,].*?)?\}$/)) ||
    isDisplayMath(token)
  );
}

export function languageBlockAtPosition(
  tokens: Token[],
  position: Position,
  includeFence = false
) {
  for (const languageBlock of tokens.filter(isExecutableLanguageBlock)) {
    if (languageBlock.map) {
      let [begin, end] = languageBlock.map;
      if (includeFence) {
        begin--;
        end++;
      }
      if (position.line > begin && position.line < end - 1) {
        return languageBlock;
      }
    }
  }
  return undefined;
}

export function isFencedCode(token: Token) {
  return token.type === "fence";
}

export function isDisplayMath(token: Token) {
  return token.type === "math_block";
}

export function isDiagram(token: Token) {
  return (
    isExecutableLanguageBlockOf("mermaid")(token) ||
    isExecutableLanguageBlockOf("dot")(token)
  );
}

export function languageNameFromBlock(token: Token) {
  if (isDisplayMath(token)) {
    return "tex";
  } else {
    const match = token.info.match(/^\{?=?([a-zA-Z0-9_\-]+)/);
    if (match) {
      return match[1].split("-").pop() || "";
    } else {
      return "";
    }
  }
}

export function isExecutableLanguageBlockOf(language: string) {
  return (token: Token) => {
    return (
      isExecutableLanguageBlock(token) &&
      languageNameFromBlock(token) === language
    );
  };
}
