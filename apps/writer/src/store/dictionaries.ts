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

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { Dictionary, editorJsonRpcServices } from "editor";
import { kWriterJsonRpcPath } from "writer-types";

const kUserDictionaryTag = "UserDictionary";

const server = editorJsonRpcServices(kWriterJsonRpcPath);

export const dictionariesApi = createApi({
  reducerPath: "dictionaries",
  baseQuery: fakeBaseQuery(),
  tagTypes: [kUserDictionaryTag],
  endpoints(build) {
    return {
      dictionary: build.query<Dictionary,string>({
        queryFn: async (locale: string) => {
          return server.dictionary.getDictionary(locale)
            .then(value => {
              return { data: value };
            })
            .catch(error => {
              return { error };
            });
        },
       
      }),
      userDictionary: build.query<string,void>({
        queryFn: () => {
          return Promise.resolve({ data: '' });
        },
        providesTags: [kUserDictionaryTag]
      }),
      addToUserDictionary: build.mutation<void,string>({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        queryFn: (_word: string) => {
          return Promise.resolve({ data: undefined });
        },
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

