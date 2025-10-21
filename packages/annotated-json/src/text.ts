/*
 * text.ts
 *
 * Text utilities for annotated-json.
 *
 * Copyright (C) 2024 by Posit Software, PBC
 * 
 */

// NB we can't use JS matchAll or replaceAll here because we need to support old
// Chromium in the IDE
//
// NB this mutates the regexp.

import { glb } from "./glb";

export function* matchAll(text: string, regexp: RegExp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}

export function* lineOffsets(text: string) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}

export function indexToLineCol(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (offset: number) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0,
      };
    }

    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex],
    };
  };
}

export function lineColToIndex(text: string) {
  const offsets = Array.from(lineOffsets(text));
  return function (position: { line: number; column: number }) {
    return offsets[position.line] + position.column;
  };
}
