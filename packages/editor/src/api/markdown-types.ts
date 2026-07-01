/*
 * markdown-types.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { Slice } from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";

export interface EditorMarkdown {
  allowMarkdownPaste(state: EditorState | Transaction) : boolean ;
  markdownToSlice(markdown: string, openStart: number, openEnd: number) : Promise<Slice>;
}
