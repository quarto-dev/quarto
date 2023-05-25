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


import { PandocToken, QuartoContext, parsePandocDocument } from "quarto-core";

import { IMdParser, ITextDocument } from "./service";
import { pandocSlugifier } from "./service";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function langaugeServiceMdParser(context: QuartoContext, resourcesDir: string) : IMdParser {

  // pandoc element cache for last document requested
  let elementCache: PandocToken[] | undefined;
  let elementCacheDocUri: string | undefined;
  let elementCacheDocVersion: number | undefined;

  const mdParser : IMdParser = {
    slugifier: pandocSlugifier,
    parsePandocTokens(doc: ITextDocument): PandocToken[] {
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
    },
  };
  return mdParser;
}




