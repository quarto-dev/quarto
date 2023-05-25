/*
 * lanugage.ts
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

import { Position } from "../position";

import { PandocToken, kAttrClasses  } from "./token";

export function isLanguageBlock(token: PandocToken) {
  return isFencedCode(token) || isDisplayMath(token);
}

// a language block that will be executed with its results
// inclued in the document (either by an engine or because
// it is a raw or display math block)
export function isExecutableLanguageBlock(token: PandocToken) {
  if (isDisplayMath(token)) {
    return true;
  } else if (isFencedCode(token)) {
    const clz = token.attr?.[kAttrClasses][0];
    if (!clz) {
      return false;
    }
    return clz.match(/^\{=?([a-zA-Z0-9_-]+)(?: *[ ,].*?)?/);
  } else {
    return false;
  }
}

export function languageBlockAtPosition(
  tokens: PandocToken[],
  position: Position,
  includeFence = false
) {
  for (const languageBlock of tokens.filter(isExecutableLanguageBlock)) {
    let start = languageBlock.range.start.line;
    let end = languageBlock.range.end.line;
    if (!includeFence) {
      start++;
      end--;
    }
    if (position.line > start && position.line < end - 1) {
      return languageBlock;
    }
  }
  return undefined;
}

export function isFencedCode(token: PandocToken) {
  return token.type === "CodeBlock";
}

export function isDisplayMath(token: PandocToken) {
  if (token.type === "Math") {
    const math = token.data as { type: string, text: string };
    return math.type === "DisplayMath";
  } else {
    return false;
  }
}

export function isDiagram(token: PandocToken) {
  return (
    isExecutableLanguageBlockOf("mermaid")(token) ||
    isExecutableLanguageBlockOf("dot")(token)
  );
}

export function languageNameFromBlock(token: PandocToken) {
  if (isDisplayMath(token)) {
    return "tex";
  } else if (isFencedCode(token)) {
    const match = token.attr?.[kAttrClasses][0].match(/^\{?=?([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1].split("-").pop() || "";
    } else {
      return "";
    }
  }
}

export function isExecutableLanguageBlockOf(language: string) {
  return (token: PandocToken) => {
    return (
      isExecutableLanguageBlock(token) &&
      languageNameFromBlock(token) === language
    );
  };
}