/*
 * editor.ts
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

import { EditorOutline } from 'editor';


export interface EditorError {
  icon: "document" | "issue" | "error" ;
  title: string;
  description: string[];
}

export interface EditorState {
  readonly loading: boolean;
  readonly loadError?: EditorError;
  readonly title: string;
  readonly outline: EditorOutline;
  readonly selection: unknown;
}

const initialState: EditorState = {
  loading: true,
  title: '',
  outline: [],
  selection: {},
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setEditorLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setEditorLoadError: (state, action: PayloadAction<EditorError>) => {
      state.loadError = action.payload;
    },
    setEditorTitle: (state, action: PayloadAction<string>) => {
      state.title = action.payload;
    },
    setEditorOutline: (state, action: PayloadAction<EditorOutline>) => {
      state.outline = action.payload;
    },
    setEditorSelection: (state, action: PayloadAction<unknown>) => {
      state.selection = action.payload;
    },
  },
})

const editorSelector = (state: { editor: EditorState }) => state.editor;
export const editorLoading = createSelector(editorSelector, (state) => state.loading);
export const editorLoadError = createSelector(editorSelector, (state) => state.loadError);
export const editorTitle = createSelector(editorSelector, (state) => state.title);
export const editorOutline = createSelector(editorSelector, (state) => state.outline);
export const editorSelection = createSelector(editorSelector, (state) => state.selection);

export const { 
  setEditorLoading, 
  setEditorLoadError,
  setEditorTitle, 
  setEditorOutline, 
  setEditorSelection 
} = editorSlice.actions

export default editorSlice.reducer;
