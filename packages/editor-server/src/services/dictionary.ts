/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * dictionary.ts
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

import fs from "fs";
import path from "path";

import jayson from "jayson";

import { jsonRpcMethod } from "core-server";

import { 
  Dictionary, 
  DictionaryInfo, 
  DictionaryServer, 
  IgnoredWord, 
  kDictionaryAddToUserDictionary, 
  kDictionaryAvailableDictionaries, 
  kDictionaryGetDictionary, 
  kDictionaryGetIgnoredwords, 
  kDictionaryGetUserDictionary, 
  kDictionaryIgnoreWord,
  kDictionaryUnignoreWord
} from "editor-types";

export interface DictionaryServerOptions {
  dictionariesDir: string;
  userDictionaryDir: string;
}

export function dictionaryServer(options: DictionaryServerOptions) : DictionaryServer {
 
  return {
    async availableDictionaries(): Promise<DictionaryInfo[]> {
      return kKnownDictionaires.filter(dictionary => {
        return fs.existsSync(path.join(options.dictionariesDir, `${dictionary.locale}.dic`))
      })
    },
    async getDictionary(locale: string): Promise<Dictionary> {
      return {
        aff: 'this is the aff',
        words: 'these are the words'
      }
    },
    async getUserDictionary() : Promise<string> {
      return '';
    },
    async addToUserDictionary(word: string) : Promise<string> {
      return word;
    },
    async getIgnoredWords(context: string) : Promise<string[]> {
      return [];
    },
    async ignoreWord(word: IgnoredWord) : Promise<string[]> {
      return [word.word];
    },
    async unignoreWord(word: IgnoredWord) : Promise<string[]> {
      return [];
    }
  }
}

export function dictionaryServerMethods(options: DictionaryServerOptions) : Record<string, jayson.Method> {
  const server = dictionaryServer(options);
  const methods: Record<string, jayson.Method> = {
    [kDictionaryAvailableDictionaries]: jsonRpcMethod(() => server.availableDictionaries()),
    [kDictionaryGetDictionary]: jsonRpcMethod(args => server.getDictionary(args[0])),
    [kDictionaryGetUserDictionary]: jsonRpcMethod(() => server.getUserDictionary()),
    [kDictionaryAddToUserDictionary]: jsonRpcMethod(args => server.addToUserDictionary(args[0])),
    [kDictionaryGetIgnoredwords]: jsonRpcMethod(args => server.getIgnoredWords(args[0])),
    [kDictionaryIgnoreWord]: jsonRpcMethod(args => server.ignoreWord(args[0])),
    [kDictionaryUnignoreWord]: jsonRpcMethod(args => server.unignoreWord(args[0]))
  }
  return methods;
}

const kKnownDictionaires: DictionaryInfo[] =
[
   { locale: "bg_BG",     name: "Bulgarian"                },
   { locale: "ca_ES",     name: "Catalan"                  },
   { locale: "cs_CZ",     name: "Czech"                    },
   { locale: "da_DK",     name: "Danish"                   },
   { locale: "de_DE",     name: "German"                   },
   { locale: "de_DE_neu", name: "German (New)"             },
   { locale: "el_GR",     name: "Greek"                    },
   { locale: "en_AU",     name: "English (Australia)"      },
   { locale: "en_CA",     name: "English (Canada)"         },
   { locale: "en_GB",     name: "English (United Kingdom)" },
   { locale: "en_US",     name: "English (United States)"  },
   { locale: "es_ES",     name: "Spanish"                  },
   { locale: "fr_FR",     name: "French"                   },
   { locale: "hr_HR",     name: "Croatian"                 },
   { locale: "hu-HU",     name: "Hungarian"                },
   { locale: "id_ID",     name: "Indonesian"               },
   { locale: "it_IT",     name: "Italian"                  },
   { locale: "lt_LT",     name: "Lithuanian"               },
   { locale: "lv_LV",     name: "Latvian"                  },
   { locale: "nb_NO",     name: "Norwegian"                },
   { locale: "nl_NL",     name: "Dutch"                    },
   { locale: "pl_PL",     name: "Polish"                   },
   { locale: "pt_BR",     name: "Portuguese (Brazil)"      },
   { locale: "pt_PT",     name: "Portuguese (Portugal)"    },
   { locale: "ro_RO",     name: "Romanian"                 },
   { locale: "ru_RU",     name: "Russian"                  },
   { locale: "sh",        name: "Serbo-Croatian"           },
   { locale: "sk_SK",     name: "Slovak"                   },
   { locale: "sl_SI",     name: "Slovenian"                },
   { locale: "sr",        name: "Serbian"                  },
   { locale: "sv_SE",     name: "Swedish"                  },
   { locale: "uk_UA",     name: "Ukrainian"                },
   { locale: "vi_VN",     name: "Vietnamese"               },
];



