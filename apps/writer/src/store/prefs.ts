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

import { 
  AnyAction,
  createListenerMiddleware,
  createSelector, 
  createSlice, 
  isAnyOf, 
  PayloadAction
} from '@reduxjs/toolkit';
import { defaultPrefs, kWriterJsonRpcPath, Prefs } from 'writer-types';
import { writerJsonRpcServer } from '../server/server';

import { WorkbenchState } from './store';

export const prefsSlice = createSlice({
  name: 'prefs',
  initialState: () => { 
    return defaultPrefs()
  },
  reducers: {
    initPrefs: (state, action: PayloadAction<Prefs>) => {
      Object.assign(state, action.payload);
    },
    setPrefShowOutline: (state, action: PayloadAction<boolean>) => {
      state.showOutline = action.payload;
    },
    setPrefShowMarkdown: (state, action: PayloadAction<boolean>) => {
      state.showMarkdown = action.payload;
    },
  },
})

const prefsSelector = (state: WorkbenchState) => state.prefs;
export const prefShowOutline = createSelector(prefsSelector, (state) => state.showOutline);
export const prefShowMarkdown = createSelector(prefsSelector, (state) => state.showMarkdown);

export const { 
  initPrefs,
  setPrefShowOutline,
  setPrefShowMarkdown, 
} = prefsSlice.actions


// middleware to persist prefs to server when changed
const server = writerJsonRpcServer(kWriterJsonRpcPath);
export const prefsPersist = createListenerMiddleware<{ prefs: Prefs }> ();
prefsPersist.startListening({
  matcher: isAnyOf(setPrefShowMarkdown, setPrefShowOutline),
  effect: async (_action: AnyAction, listenerApi) => {
    await server.prefs.setPrefs(listenerApi.getState().prefs);
  }
})

export default prefsSlice.reducer;




