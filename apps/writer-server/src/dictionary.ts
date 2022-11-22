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

import jayson from "jayson";

import { jsonRpcMethod } from "core-server";

import { Dictionary, DictionaryServer, kDictionaryAddToUserDictionary, kDictionaryGetDictionary, kDictionaryGetUserDictionary } from "writer-types";


export interface DictionaryServerOptions {
  dictionariesDir: string;
  userDictionaryDir: string;
}

export function dictionaryServer(options: DictionaryServerOptions) : DictionaryServer {
 
  return {
    async getDictionary(locale: string): Promise<Dictionary> {
      return {
        aff: '',
        words: ''
      }
    },
    async getUserDictionary() : Promise<string> {
      return '';
    },
    async addToUserDictionary(word: string) : Promise<void> {
      //
    }
  }

}

export function dictionaryServerMethods(options: DictionaryServerOptions) : Record<string, jayson.Method> {
  const server = dictionaryServer(options);
  const methods: Record<string, jayson.Method> = {
    [kDictionaryGetDictionary]: jsonRpcMethod(args => server.getDictionary(args[0])),
    [kDictionaryGetUserDictionary]: jsonRpcMethod(() => server.getUserDictionary()),
    [kDictionaryAddToUserDictionary]: jsonRpcMethod(args => server.addToUserDictionary(args[0]))
  }
  return methods;
}




