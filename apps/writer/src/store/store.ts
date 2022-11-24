/*
 * store.ts
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

import { configureStore } from '@reduxjs/toolkit'
import { dictionariesApi } from './dictionaries';
import { editorSlice } from './editor';
import { prefsSlice, prefsPersist } from './prefs';

const store = configureStore({
  reducer: {
    editor: editorSlice.reducer,
    prefs: prefsSlice.reducer,
    [dictionariesApi.reducerPath]: dictionariesApi.reducer
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware()
        .prepend(prefsPersist.middleware)
        .concat(dictionariesApi.middleware)
  }
});

export type WorkbenchState = ReturnType<typeof store.getState>

export default store;


