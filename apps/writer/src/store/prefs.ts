/*
 * prefs.ts
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
import { jsonRpcBrowserRequestTransport } from "core-browser";
import { Prefs, kWriterJsonRpcPath } from "writer-types";
import { writerJsonRpcServer } from "../server/server";

import { rtkFakeBaseQuery, rtkHandleQuery } from "editor-ui";

const kPrefsTag = "Prefs";

const request = jsonRpcBrowserRequestTransport(kWriterJsonRpcPath);
const server = writerJsonRpcServer(request);

export const prefsApi = createApi({
  reducerPath: "prefs",
  baseQuery: rtkFakeBaseQuery<JsonRpcError>(),
  tagTypes: [kPrefsTag],

  endpoints(build) {
    return {
      getPrefs: build.query<Prefs,void>({
        queryFn: () => rtkHandleQuery(server.prefs.getPrefs()),
        providesTags: [kPrefsTag]
      }),
      setPrefs: build.mutation<void,Prefs>({
        queryFn: (prefs: Prefs) => rtkHandleQuery(server.prefs.setPrefs(prefs)),
        // optmistic update 
        async onQueryStarted(prefs, { dispatch, queryFulfilled }) {
          dispatch(
            prefsApi.util.updateQueryData("getPrefs", undefined, draft => {
              Object.assign(draft, prefs);
            })
          )
          try {
            await queryFulfilled
          } catch (error) {
            // refetch on failure
            dispatch(prefsApi.util.invalidateTags([kPrefsTag]));
          }
        }
      })
    };
  },
});

export const {
  useGetPrefsQuery,
  useSetPrefsMutation
} = prefsApi;