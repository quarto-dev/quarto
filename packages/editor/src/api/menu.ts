/*
 * menu.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { ResolvedPos } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { EditorMenuItem } from "editor-types";


export interface ContextMenuSource {
  items: () => Promise<EditorMenuItem[]>;
  preventSelectionChange?: (state: EditorState) => boolean
}

export type ContextMenuHandlerFn = (view: EditorView, $pos: ResolvedPos) => ContextMenuSource | null;

