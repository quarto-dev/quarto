/*
 * dictionaries.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kDictionaryAvailableDictionaries = "dictionary_available_dictionaries";
export const kDictionaryGetDictionary = "dictionary_get_dictionary";
export const kDictionaryGetUserDictionary = "dictionary_get_user_dictionary";
export const kDictionaryAddToUserDictionary = "dictionary_add_to_user_dictionary";
export const kDictionaryGetIgnoredwords = "dictionary_get_ignored_words";
export const kDictionaryIgnoreWord = "dictionary_ignore_word";
export const kDictionaryUnignoreWord = "dictionary_unignore_word";

// https://github.com/rstudio/rstudio/commit/19c6fe31d25b7b3cb8ec8f51be42cc7f2d21e4b5

export interface DictionaryInfo {
  locale: string;
  name: string;
}

export interface Dictionary {
  aff: string;
  words: string;
}

export interface IgnoredWord {
  context: string;
  word: string;
}

export interface DictionaryServer {
  availableDictionaries: () => Promise<DictionaryInfo[]>;
  getDictionary: (locale: string) => Promise<Dictionary>;
  getUserDictionary: () => Promise<string[]>;
  addToUserDictionary: (word: string) => Promise<string[]>;
  getIgnoredWords: (context: string) => Promise<string[]>;
  ignoreWord: (word: IgnoredWord) => Promise<string[]>;
  unignoreWord: (word: IgnoredWord) => Promise<string[]>;
}



