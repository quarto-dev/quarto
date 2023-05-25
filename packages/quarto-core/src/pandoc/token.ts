/*
 * element.ts
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

import { Range } from '../range';

export type TokenType =
  | "FrontMatter"
  | "BlockQuote"
  | "BulletList"
  | "CodeBlock"
  | "Div"
  | "Header"
  | "HorizontalRule"
  | "OrderedList"
  | "Para"
  | "RawBlock"
  | "Table"
  | "Code"
  | "Image"
  | "Link"
  | "Math"
  | "Note"
  | "RawInline"
  | "Span";


export const kAttrIdentifier = 0;
export const kAttrClasses = 1;
export const kAttrAttributes = 2;
export type TokenAttr = [string, Array<string>, Array<[string,string]>];


export interface Token<T = unknown> {
  type: TokenType;
  range: Range;
  level?: number;
  attr?: TokenAttr; 
  data: T;
    // FrontMatter: yaml
    // Header: text
    // Image: caption
    // Link: target
    // Math: { type: string, text: string }
    // CodeBlock: text
    // RawBlock: { format: string, text: string }
    // (Other): null
}

export type TokenFrontMatter = Token<string>;
export function isFrontMatter(token: Token) : token is TokenFrontMatter {
  return token.type === "FrontMatter";
}

export type TokenHeader = Token<string>;
export function isHeader(token: Token) : token is TokenHeader {
  return token.type === "Header";
}

export type TokenImage = Token<string>;
export function isImage(token: Token): token is TokenImage {
  return token.type === "Image";
}

export type TokenLink = Token<string>;
export function isLink(token: Token): token is TokenLink {
  return token.type === "Link";
}

export type TokenMath = Token<{ type: string, text: string }>;
export function isMath(token: Token): token is TokenMath {
  return token.type === "Math";
}

export type TokenCodeBlock = Token<string>;
export function isCodeBlock(token: Token): token is TokenCodeBlock {
  return token.type === "CodeBlock";
}

export type TokenRawBlock = Token<{ format: string, text: string }>;
export function isRawBlock(token: Token): token is TokenRawBlock {
  return token.type === "RawBlock";
}

export function isCallout(token: Token) {
  if (token.type === "Div") {
    const classes = token.attr![kAttrClasses];
    return !!classes.find(clz => clz.startsWith("callout-"));
  } else {
    return false;
  }
}

export function isList(token: Token) {
  return ["BulletList", "OrderedList"].includes(token.type);
}

export function isTabset(token: Token) {
  if (token.type === "Div") {
    const classes = token.attr![kAttrClasses];
    return !!classes.find(clz => clz === "panel-tabset");
  } else {
    return false;
  }
}

export function isTheorem(token: Token) {
  if (token.type === "Div") {
    const id = token.attr![kAttrIdentifier];
    return ["thm", "lem", "cor", "prp", "cnj", "def", "exm", "exr"]
      .some(prefix => id.startsWith(`${prefix}-`));
  } else {
    return false;
  }
}

export function isProof(token: Token) {
  if (token.type === "Div") {
    const classes = token.attr![kAttrClasses];
    return ["proof", "remark", "solution"].some(clz => classes.includes(clz));
  } else {
    return false;
  }
}

export function isWithinRange(tokens: Token[], rangePredicate: (token: Token) => boolean) {
  const ranges = tokens.reduce((ranges, token) => {
    if (rangePredicate(token)) {
      ranges.push({ begin: token.range.start.line, end: token.range.end.line });
    }
    return ranges;
  }, new Array<{ begin: number, end: number }>())
  return (token: Token) => {
    return ranges.find(range => {
      return token.range.start.line >= range.begin && token.range.end.line <= range.end;
    })
  };
}