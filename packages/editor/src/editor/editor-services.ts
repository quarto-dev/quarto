/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * editor-services.ts
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

import { jsonRpcBrowserClient } from "core-client";

import {
  Dictionary,
  DictionaryInfo,
  EditorServices,
  IgnoredWord,
  kDictionaryAddToUserDictionary,
  kDictionaryAvailableDictionaries,
  kDictionaryGetDictionary,
  kDictionaryGetIgnoredwords,
  kDictionaryGetUserDictionary,
  kDictionaryIgnoreWord,
  kDictionaryUnignoreWord,
  kMathMathjaxTypesetSvg,
  
} from "editor-types";


export function editorJsonRpcServices(url: string) : EditorServices {

  const request = jsonRpcBrowserClient(url);

  return {
    math: {
      mathjaxTypeset(math, options) {
        return request(kMathMathjaxTypesetSvg, [math, options]);
      },
    },
    dictionary: {
      availableDictionaries() : Promise<DictionaryInfo[]> {
        return request(kDictionaryAvailableDictionaries, []);
      },
      getDictionary(locale: string) : Promise<Dictionary> {
        return request(kDictionaryGetDictionary, [locale]);
      },
      getUserDictionary() : Promise<string> {
        return request(kDictionaryGetUserDictionary, []);
      },
      addToUserDictionary(word: string) : Promise<string> {
        return request(kDictionaryAddToUserDictionary, [word]);
      },
      getIgnoredWords(context: string):  Promise<string[]> {
        return request(kDictionaryGetIgnoredwords, [context]);
      },
      ignoreWord(word: IgnoredWord) : Promise<string[]> {
        return request(kDictionaryIgnoreWord, [word]);
      },
      unignoreWord(word: IgnoredWord) : Promise<string[]> {
        return request(kDictionaryUnignoreWord, [word]);
      }
    }
  };
}
