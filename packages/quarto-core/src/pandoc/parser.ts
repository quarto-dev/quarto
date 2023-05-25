/*
 * parser.ts
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

import path from "node:path"

import { QuartoContext } from "../context";
import { Token, TokenFrontMatter, isCodeBlock, kAttrClasses } from "./token";
import { partitionYamlFrontMatter } from "../metadata";
import { lines } from "core";
import { makeRange } from "../range";
import { isExecutableLanguageBlock, languageNameFromBlock } from "./language";

export function parsePandocDocument(context: QuartoContext, resourcePath: string, markdown: string) : Token[] {
 
  try {
    const output = context.runPandoc(
      { input: markdown },
      "--from", "commonmark_x+sourcepos",
       "--to", "plain",
       "--lua-filter", path.join(resourcePath, 'parser.lua')
    );
  
    // parse json (w/ some fixups)
    const outputJson = JSON.parse(output) as Record<string,Token>;
    const tokens = (Object.values(outputJson).map(token => {
  
      // fixup lang
      if (isCodeBlock(token) && isExecutableLanguageBlock(token)) {
        const lang = languageNameFromBlock(token);
        token.attr![kAttrClasses][0] = `{${lang}}`;
      } 
      
      // return token
      return token;
    }));
  
  
    // add a FrontMatter token if there is front matter
    const result = partitionYamlFrontMatter(markdown);
    if (result) {
      const yamlLines = lines(result.yaml);
      const yamlToken: TokenFrontMatter = {
        type: "FrontMatter",
        data: result.yaml,
        range: makeRange(0, 0, yamlLines.length - 1, 0)
      }
      tokens.unshift(yamlToken);
    }
  
    return tokens;

  } catch(error) {
    // message has already been written to stderr
    return [];
  
  }
}


