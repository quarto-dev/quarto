/*
 * markdownit.ts
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


import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";

import attrPlugin from 'markdown-it-attrs';

import { Document } from "../../document";

import { Parser, cachingParser } from "../parser";
import { Token as QToken, TokenAttr, kAttrAttributes, kAttrClasses, kAttrIdentifier } from "../token";
import { divPlugin, lines, mathjaxPlugin, yamlPlugin } from "core";

import { makeRange } from "../../range";

export function markdownitParser() : Parser {

  // block parser
  const md = MarkdownIt("zero");
  md.enable([
    "blockquote",
    "code",
    "fence",
    "heading",
    "lheading",
    "html_block",
    "list",
    "paragraph",
    "hr",
    "table"
  ]);
  md.use(attrPlugin);
  md.use(mathjaxPlugin, { enableInlines: false } );
  md.use(yamlPlugin);
  md.use(divPlugin);

  // inline parser
  const mdInline = MarkdownIt("commonmark");
  const mdToText = (markdown: string ) => {
    const tokens = mdInline.parseInline(markdown, {});
    return tokensToText(tokens);
  }

  return cachingParser((doc: Document) => {
    return parseDocument(md, mdToText, doc.getText());
  })
}

type MarkdownToPlainText = (markdown: string) => string;

function parseDocument(
  md: MarkdownIt, 
  mdToText: MarkdownToPlainText, 
  markdown: string
) : QToken[] {
  
  // remove unicode newlines
  const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;
  markdown = markdown.replace(UNICODE_NEWLINE_REGEX, "");

  type HeaderInfo = { open: Token; body: Token[] };
  let currentHeader: HeaderInfo | undefined;

  // parse markdown and generate tokens
  const tokens: QToken[] = [];
  const inputLines = lines(markdown);
  const mdItTokens = md.parse(markdown, {});

  const tokenRange = (map: [number, number]) => {
    // TODO: trim only if required
    return makeRange(
      map[0], 
      0, 
      map[1] - 1, 
      inputLines[map[1]-1].length
    );
  };

  for (let i=0; i<mdItTokens.length; i++)  {

    const token = mdItTokens[i];

    // look for our tokens
    switch(token.type) {
      case "paragraph_open": {
        if (token.map) {
          tokens.push({ type: "Para", range: tokenRange(token.map), data: null });
        } else {
          console.log("paragraph did not have map");
        }
        break;
      }
      case "heading_open": {
        currentHeader = { open: token, body: [] };
        break;
      }
      case "heading_close": {
        if (currentHeader) {
          const level = currentHeader.open.tag.match(/h(\d+)/)?.[1];
          if (level && currentHeader.open.map) {
            const text = tokensToText(currentHeader.body).trim();
            tokens.push({ 
              type: "Header", 
              range: tokenRange(currentHeader.open.map), 
              attr: asTokenAttr(currentHeader.open.attrs),
              data: { level: parseInt(level), text: mdToText(text)} 
            });
          } else {
            console.log("heading_open did not have level or map")
          }
          currentHeader = undefined;
        }
        break;
      }
      default: {
        if (currentHeader) {
          currentHeader.body.push(token);
        }
        break;
      }
        
    }
  
  }
  
  return tokens;
}


const tokensToText = (tokens: Token[]) : string => {
  return tokens.map(token => {
    if (token.children) {
      return tokensToText(token.children);
    } else {
      return token.content;
    }
  }).join("");
}

const asTokenAttr = (attribs: Array<[string,string]> | null) => {
  const tokenAttr: TokenAttr = ['', [], []];
  if (attribs === null) {
    return tokenAttr;
  }
  for (const attrib of attribs) {
    const key = attrib[0];
    const value = attrib[1];
    switch(key) {
      case 'id':
        tokenAttr[kAttrIdentifier] = value;
        break;
      case 'class':
        tokenAttr[kAttrClasses].push(...value.split(' '));
        break;
      default:
        tokenAttr[kAttrAttributes].push([key,value]);
    }
  }
  return tokenAttr;
}