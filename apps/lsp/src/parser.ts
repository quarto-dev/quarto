/*
 * parser.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { pandocAutoIdentifier } from "core";

import { QuartoContext } from "quarto-core";

import { IMdParser, ISlugifier, ITextDocument, Token, Slug } from "./service";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function langaugeServiceMdParser(_context: QuartoContext, _resourcesDir: string) : IMdParser {

  // markdownit instance
  const mdIt = MarkdownIt({ html: true });

  // token cache for last document requested
  let tokenCache: Token[] | undefined;
  let tokenCacheDocUri: string | undefined;
  let tokenCacheDocVersion: number | undefined;

  const mdParser : IMdParser = {
    slugifier: pandocSlugifier,
    async tokenize(doc: ITextDocument): Promise<Token[]> {
      if (
        !tokenCache ||
        doc.uri.toString() !== tokenCacheDocUri ||
        doc.version !== tokenCacheDocVersion
      ) {
        tokenCache = mdIt.parse(doc.getText(), {});
        tokenCacheDocUri = doc.uri.toString();
        tokenCacheDocVersion = doc.version;
      }
      return tokenCache;
    }
  };
  return mdParser;
}


const pandocSlugifier: ISlugifier = new class implements ISlugifier {
	fromHeading(heading: string): Slug {
    const slugifiedHeading = pandocAutoIdentifier(heading);
		return new Slug(slugifiedHeading);
	}
};




