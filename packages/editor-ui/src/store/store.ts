/*
 * index.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { configureStore } from '@reduxjs/toolkit'
import { JsonRpcRequestTransport } from 'core';

import { editorJsonRpcServices } from 'editor-core';
import { dictionaryApi, initDictionaryApi, editorsSlice, initPrefsApi, prefsApi } from 'editor-ui';


export async function initializeStore(request: JsonRpcRequestTransport) {

  const store = configureStore({
    reducer: {
      editors: editorsSlice.reducer,
      [prefsApi.reducerPath]: prefsApi.reducer,
      [dictionaryApi.reducerPath]: dictionaryApi.reducer
    },
    middleware: (getDefaultMiddleware) => {
      return getDefaultMiddleware()
          .prepend(prefsApi.middleware)
          .prepend(dictionaryApi.middleware)
    }
  });

  // get editor services
  const editorServices = editorJsonRpcServices(request);

  // connect prefs and dictionary apis to services endpoints
  initPrefsApi(editorServices.prefs);
  initDictionaryApi(editorServices.dictionary);
  
  // prefech prefs
  store.dispatch(prefsApi.util.prefetch("getPrefs", undefined, {force: true}));
  await Promise.all(store.dispatch(prefsApi.util.getRunningQueriesThunk()));

  // return store
  return store;
}

export type EditorUIStore = Awaited<ReturnType<typeof initializeStore>>;
