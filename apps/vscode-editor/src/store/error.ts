/*
 * error.ts
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

import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit'

import { IconName } from '@blueprintjs/icons';

export interface ErrorInfo {
  icon: IconName;
  title: string;
  description: string[];
}

export interface ErrorState {
  readonly load?: ErrorInfo;
}

const initialState: ErrorState = {};

export const errorSlice = createSlice({
  name: 'error',
  initialState,
  reducers: {
    setLoadError: (state, action: PayloadAction<ErrorInfo>) => {
      state.load = action.payload;
    }
  },
})

const errorSelector = (state: { error: ErrorState }) => state.error;

export const loadError = createSelector(errorSelector, (state) => state.load);

export const { setLoadError } = errorSlice.actions

export default errorSlice.reducer;
