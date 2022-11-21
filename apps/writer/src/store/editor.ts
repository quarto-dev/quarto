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
import { WorkbenchState } from './store';

export interface EditorState {
  readonly loading: boolean;
  readonly title: string;
  readonly markdown: string;
  readonly outline: EditorOutline;
  readonly selection: unknown;
}

const initialState: EditorState = {
  loading: true,
  title: '',
  markdown: '',
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
    setEditorTitle: (state, action: PayloadAction<string>) => {
      state.title = action.payload;
    },
    setEditorMarkdown: (state, action: PayloadAction<string>) => {
      state.markdown = action.payload;
    },
    setEditorOutline: (state, action: PayloadAction<EditorOutline>) => {
      state.outline = action.payload;
    },
    setEditorSelection: (state, action: PayloadAction<unknown>) => {
      state.selection = action.payload;
    },
  },
})

const editorSelector = (state: WorkbenchState) => state.editor;
export const editorLoading = createSelector(editorSelector, (state) => state.loading);
export const editorTitle = createSelector(editorSelector, (state) => state.title);
export const editorMarkdown = createSelector(editorSelector, (state) => state.markdown);
export const editorOutline = createSelector(editorSelector, (state) => state.outline);
export const editorSelection = createSelector(editorSelector, (state) => state.selection);

export const { 
  setEditorLoading, 
  setEditorTitle, 
  setEditorMarkdown, 
  setEditorOutline, 
  setEditorSelection 
} = editorSlice.actions

export default editorSlice.reducer;
