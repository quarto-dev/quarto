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

import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WorkbenchState } from './store';

export interface PrefsState {
  readonly showOutline: boolean;
  readonly showMarkdown: boolean;
}

// automatically save and load prefs from local storage
const kPrefsLocalStorage = 'panmirror-prefs';

function savePrefs(prefs: PrefsState) {
  try {
    const serializedPrefs = JSON.stringify(prefs);
    localStorage.setItem(kPrefsLocalStorage, serializedPrefs);
  } catch {
    // ignore write errors
  }
}

function loadPrefs() {
  const defaultPrefs = {
    showOutline: false,
    showMarkdown: false,
  };
  try {
    const serializedPrefs = localStorage.getItem(kPrefsLocalStorage);
    if (serializedPrefs === null) {
      return defaultPrefs;
    }
    return {
      ...defaultPrefs,
      ...JSON.parse(serializedPrefs),
    };
  } catch (err) {
    return defaultPrefs;
  }
}

export const prefsSlice = createSlice({
  name: 'prefs',
  initialState: () => loadPrefs(),
  reducers: {
    setPrefsShowOutline: (state, action: PayloadAction<boolean>) => {
      state.showOutline = action.payload;
      savePrefs(state);
    },
    setPrefsShowMarkdown: (state, action: PayloadAction<boolean>) => {
      state.showMarkdown = action.payload;
      savePrefs(state);
    },
  },
})

const prefsSelector = (state: WorkbenchState) => state.prefs;
export const prefsShowOutline = createSelector(prefsSelector, (state) => state.showOutline);
export const prefsShowMarkdown = createSelector(prefsSelector, (state) => state.showMarkdown);

export const { 
  setPrefsShowOutline,
  setPrefsShowMarkdown, 
} = prefsSlice.actions




export default prefsSlice.reducer;




