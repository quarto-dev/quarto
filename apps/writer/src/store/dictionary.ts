/*
 * dictionaries.ts
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

import { createApi } from "@reduxjs/toolkit/query/react";
import { JsonRpcError } from "core";
import { jsonRpcBrowserRequestTransport } from "core-client";
import { Dictionary, DictionaryInfo, editorJsonRpcServices, IgnoredWord } from "editor";
import { kWriterJsonRpcPath } from "writer-types";
import { fakeBaseQuery, handleQuery } from "./util";

const kUserDictionaryTag = "UserDictionary";
const kIgnoredWordsTag = "IgnoredWords";

const request = jsonRpcBrowserRequestTransport(kWriterJsonRpcPath);
const server = editorJsonRpcServices(request);

export const dictionaryApi = createApi({
  reducerPath: "dictionary",
  baseQuery: fakeBaseQuery<JsonRpcError>(),
  tagTypes: [kUserDictionaryTag, kIgnoredWordsTag],
  endpoints(build) {
    return {
      getAvailableDictionaries: build.query<DictionaryInfo[],void>({
        queryFn: () => handleQuery(server.dictionary.availableDictionaries())
      }),
      getDictionary: build.query<Dictionary,string>({
        queryFn: (locale: string) => handleQuery(server.dictionary.getDictionary(locale))
      }),
      getUserDictionary: build.query<string[],void>({
        queryFn: () => handleQuery(server.dictionary.getUserDictionary()),
        providesTags: [kUserDictionaryTag]
      }),
      addToUserDictionary: build.mutation<string[],string>({
        queryFn: (word: string) => handleQuery(server.dictionary.addToUserDictionary(word)),
        invalidatesTags: [kUserDictionaryTag]
      }),
      ignoredWords: build.query<string[],string>({
        queryFn: (context: string) => handleQuery(server.dictionary.getIgnoredWords(context)),
        providesTags: (_result, _error, arg) => [{ type: kIgnoredWordsTag, id: arg }]
      }),
      ignoreWord: build.mutation<string[], IgnoredWord>({
        queryFn: (word: IgnoredWord) => handleQuery(server.dictionary.ignoreWord(word)),
        invalidatesTags: (_result, _error, arg) =>  [{ type: kIgnoredWordsTag, id: arg.context }]
      }),
      unignoreWord: build.mutation<string[], IgnoredWord>({
        queryFn: (word: IgnoredWord) => handleQuery(server.dictionary.unignoreWord(word)),
        invalidatesTags: (_result, _error, arg) =>  [{ type: kIgnoredWordsTag, id: arg.context }]
      }) 
    };
  },
});


export const {
  useGetAvailableDictionariesQuery,
  useGetDictionaryQuery,
  useGetUserDictionaryQuery,
  useAddToUserDictionaryMutation,
  useIgnoredWordsQuery,
  useIgnoreWordMutation,
  useUnignoreWordMutation
} = dictionaryApi;
