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
import { JSONRPCError } from "core";
import { Dictionary, editorJsonRpcServices } from "editor";
import { kWriterJsonRpcPath } from "writer-types";
import { fakeBaseQuery, handleQuery } from "./util";

const kUserDictionaryTag = "UserDictionary";

const server = editorJsonRpcServices(kWriterJsonRpcPath);

export const dictionariesApi = createApi({
  reducerPath: "dictionaries",
  baseQuery: fakeBaseQuery<JSONRPCError>(),
  tagTypes: [kUserDictionaryTag],
  endpoints(build) {
    return {
      dictionary: build.query<Dictionary,string>({
        queryFn: (locale: string) => handleQuery(server.dictionary.getDictionary(locale))
      }),
      userDictionary: build.query<string,void>({
        queryFn: () => handleQuery(server.dictionary.getUserDictionary()),
        providesTags: [kUserDictionaryTag]
      }),
      addToUserDictionary: build.mutation<void,string>({
        queryFn: (word: string) => handleQuery(server.dictionary.addToUserDictionary(word)),
        invalidatesTags: [kUserDictionaryTag]
      })
    };
  },
});

export const {
  useDictionaryQuery,
  useUserDictionaryQuery,
  useAddToUserDictionaryMutation
} = dictionariesApi;
