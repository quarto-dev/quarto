/*
 * parser.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Token } from "./token";
import { Document } from "../document"


export type Parser = (document: Document) => Token[];


export function cachingParser(parser: Parser) : Parser {

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
      elementCache = parser(doc);
      elementCacheDocUri = doc.uri.toString();
      elementCacheDocVersion = doc.version;
    }
    return elementCache;
  }
  
}


