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
