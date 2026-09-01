/*
 * clear_formatting.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorState, Transaction } from 'prosemirror-state';

import { Extension } from '../api/extension';
import { ProsemirrorCommand, EditorCommandId } from '../api/command';
import { clearFormatting } from '../api/formatting';

const extension: Extension = {
  commands: () => {
    return [new ProsemirrorCommand(EditorCommandId.ClearFormatting, ['Mod-\\'], (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      if (dispatch) {
        const tr = state.tr;
        const { from, to } = tr.selection;
        clearFormatting(tr, from, to);
        dispatch(tr);
      }
      return true;
    })];
  },
};

export default extension;
