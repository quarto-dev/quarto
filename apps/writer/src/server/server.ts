/*
 * server.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { jsonRpcBrowserClient } from "core";
import { Dictionary, kDictionaryAddToUserDictionary, kDictionaryGetDictionary, kDictionaryGetUserDictionary, WriterServer } from "writer-types";


export function writerJsonRpcServer(url: string) : WriterServer {

  const request = jsonRpcBrowserClient(url);

  return {
    dictionary: {
      getDictionary(locale: string) : Promise<Dictionary> {
        return request(kDictionaryGetDictionary, [locale]);
      },
      getUserDictionary() : Promise<string> {
        return request(kDictionaryGetUserDictionary, []);
      },
      addToUserDictionary(word: string) : Promise<void> {
        return request(kDictionaryAddToUserDictionary, [word]);
      }
    }
  }
}

