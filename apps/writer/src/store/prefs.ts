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

import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { Prefs, kWriterJsonRpcPath } from "writer-types";
import { writerJsonRpcServer } from "../server/server";

const kPrefsTag = "Prefs";

const server = writerJsonRpcServer(kWriterJsonRpcPath);

export const prefsApi = createApi({
  reducerPath: "prefs",
  baseQuery: fakeBaseQuery(),
  tagTypes: [kPrefsTag],

  endpoints(build) {
    return {
      getPrefs: build.query<Prefs,void>({
        queryFn: async () => {
          return server.prefs.getPrefs()
            .then(value => {
              return { data: value };
            })
            .catch(error => {
              return { error };
            });
        },
        providesTags: [kPrefsTag]
      }),
      setPrefs: build.mutation<void,Prefs>({
        queryFn: async (prefs: Prefs) => {
          await server.prefs.setPrefs(prefs);
          return { data: undefined };
        },
        // optmistic updates for prefs
        // https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates
        async onQueryStarted(prefs, { dispatch, queryFulfilled }) {
          dispatch(
            prefsApi.util.updateQueryData("getPrefs", undefined, draft => {
              Object.assign(draft, prefs);
            })
          )
          try {
            await queryFulfilled
          } catch {
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