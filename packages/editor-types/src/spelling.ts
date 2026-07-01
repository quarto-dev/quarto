/*
 * spelling.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export interface EditorUISpelling {
  checkWords: (words: string[]) => string[];
  suggestionList: (word: string, callback: (suggestions: string[]) => void) => void;
  addToDictionary: (word: string) => void;
  isWordIgnored: (word: string) => boolean;
  ignoreWord: (word: string) => void;
  unignoreWord: (word: string) => void;
}








