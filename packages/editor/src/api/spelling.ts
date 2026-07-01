/*
 * spelling.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


export interface EditorAnchor {
  getPosition: () => number;
}

export interface EditorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorWordRange {
  start: number;
  end: number;
}

export interface EditorWordSource {
  hasNext: () => boolean;
  next: () => EditorWordRange | null;
}

export interface EditorSpellingDoc {
  getWords: (start: number, end: number) => EditorWordSource;

  createAnchor: (pos: number) => EditorAnchor;

  shouldCheck: (wordRange: EditorWordRange) => boolean;
  setSelection: (wordRange: EditorWordRange) => void;
  getText: (wordRange: EditorWordRange) => string;

  getCursorPosition: () => number;
  replaceSelection: (text: string) => void;
  getSelectionStart: () => number;
  getSelectionEnd: () => number;

  getCursorBounds: () => EditorRect;
  moveCursorNearTop: () => void;

  dispose: () => void;
}
