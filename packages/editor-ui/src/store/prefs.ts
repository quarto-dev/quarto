/*
 * prefs.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { createApi } from "@reduxjs/toolkit/query/react";
import { JsonRpcError } from "core";
import { defaultPrefs, Prefs, PrefsServer } from "editor-types";

import { EditorUIStore, rtkFakeBaseQuery, rtkHandleQuery } from "editor-ui";

const kPrefsTag = "Prefs";

// allow external initialization of the server endpoint
let prefsServer: PrefsServer;
export function initPrefsApi(server: PrefsServer) {
  prefsServer = server;
}

export async function updatePrefsApi(store: EditorUIStore, prefs: Prefs) {
  await store.dispatch(prefsApi.util.upsertQueryData("getPrefs", undefined, prefs))
}

export function readPrefsApi(store: EditorUIStore) {
  const result = prefsApi.endpoints.getPrefs.select()(store.getState());
  const { data: prefs = defaultPrefs() } = result;
  return prefs;
}


export const prefsApi = createApi({
  reducerPath: "prefs",
  baseQuery: rtkFakeBaseQuery<JsonRpcError>(),
  tagTypes: [kPrefsTag],

  endpoints(build) {
    return {
      getPrefs: build.query<Prefs,void>({
        queryFn: () => rtkHandleQuery(prefsServer.getPrefs()),
        providesTags: [kPrefsTag]
      }),
      setPrefs: build.mutation<void,Prefs>({
        queryFn: (prefs: Prefs) => rtkHandleQuery(prefsServer.setPrefs(prefs)),
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