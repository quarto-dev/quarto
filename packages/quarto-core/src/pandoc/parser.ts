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
import { partitionYamlFrontMatter } from "./yaml";
import { lines } from "core";
import { makeRange } from "../range";
import { Document } from "../document";
import { isExecutableLanguageBlock, languageNameFromBlock } from "./language";

export type Parser = (document: Document) => Token[];

export function pandocParser(context: QuartoContext, resourcesDir: string) : Parser {

  // pandoc element cache for last document requested
  let elementCache: Token[] | undefined;
  let elementCacheDocUri: string | undefined;
  let elementCacheDocVersion: number | undefined;

  return (doc: Document): Token[] => {
    if (
      !elementCache ||
      doc.uri.toString() !== elementCacheDocUri ||
      doc.version !== elementCacheDocVersion
    ) {
      elementCache = parsePandocDocument(context, resourcesDir, doc.getText());
      elementCacheDocUri = doc.uri.toString();
      elementCacheDocVersion = doc.version;
    }
    return elementCache;
  }
}

export function parsePandocDocument(context: QuartoContext, resourcePath: string, markdown: string) : Token[] {
 
  // remove the yaml front matter by replacing it with blank lines 
  // (if its invalid it will prevent parsing of the document)
  const partitioned = partitionYamlFrontMatter(markdown);
  const yaml = partitioned ? partitioned.yaml : null;
  const input = partitioned 
    ? "\n".repeat(lines(partitioned.yaml).length-1) +  partitioned.markdown
    : markdown;

  try {
    const output = context.runPandoc(
      { input },
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
    if (yaml) {
      const yamlLines = lines(yaml);
      const yamlToken: TokenFrontMatter = {
        type: "FrontMatter",
        data: yaml,
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


