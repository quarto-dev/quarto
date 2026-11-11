/*
 * refs.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Position } from "vscode-languageserver-types";

import { Document, Parser, isContentPosition } from "quarto-core";


export function bypassRefIntelligence(
  parser: Parser,
  doc: Document,
  pos: Position,
  line: string
): boolean {
  // bypass if the current line doesn't contain a @
  // (performance optimization so we don't execute the regexs
  // below if we don't need to)
  if (line.indexOf("@") === -1) {
    return true;
  }

  // ensure we have the file scheme
  if (!doc.uri.startsWith("file:")) {
    return true;
  }

  // check if we are in markdown
  if (!isContentPosition(parser, doc, pos)) {
    return true;
  }

  return false;
}

// find the citation (`@key`) under the cursor, from the '@' to the end of the key
export function citeAtPosition(
  line: string,
  character: number
): { id: string; start: number; end: number } | undefined {
  // include the character under the cursor so hovering the '@' finds its own citation
  const start = line.slice(0, character + 1).lastIndexOf("@");
  if (start === -1) {
    return undefined;
  }
  const citeMatch = line.slice(start).match(/^@[^@;[\]\s!,]+/);
  if (!citeMatch) {
    return undefined;
  }
  const id = citeMatch[0].replace(/\.$/, "").slice(1);
  const end = start + id.length + 1;
  if (!id || character >= end) {
    return undefined;
  }
  return { id, start, end };
}
