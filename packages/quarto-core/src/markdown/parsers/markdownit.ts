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
import { Document } from "../../document";

import { Parser, cachingParser } from "../parser";
import { Token } from "../token";
import { divPlugin, lines, mathjaxPlugin, yamlPlugin } from "core";
import { makeRange } from "../../range";


export function markdownitParser() : Parser {

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
  md.use(mathjaxPlugin, { enableInlines: false } );
  md.use(yamlPlugin);
  md.use(divPlugin);

  return cachingParser((doc: Document) => {
    return parseDocument(md, doc.getText());
  })
}

const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;

function parseDocument(md: MarkdownIt, markdown: string) : Token[] {
  // parse markdown and generate tokens
  markdown = markdown.replace(UNICODE_NEWLINE_REGEX, "");
  const inputLines = lines(markdown);
  const tokens = md.parse(markdown, {}).reduce((tokens, token) => {

    console.log(token);

    // only process blocks w/ a range
    if (!token.block || !token.map) {
      return tokens;
    }

    // compute range
    const range = makeRange(
      token.map[0], 
      0, 
      token.map[1] - 1, 
      inputLines[token.map[1]-1].length
    )
    
    // look for our tokens
    switch(token.type) {
      case "paragraph_open": {
        tokens.push({ type: "Para", range, data: null });
        break;
      }
      case "heading":
      case "lheading": {
        tokens.push({ type: "Header", range, data: null })
        break;
      }
    }
   
    return tokens;
  }, new Array<Token>());
  
  return tokens;
}
