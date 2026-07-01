/*
 * hard_break.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { EditorState, Transaction } from 'prosemirror-state';

import { Extension } from '../api/extension';
import { BaseKey } from '../api/basekeys';
import { PandocOutput, PandocTokenType } from '../api/pandoc';

const extension: Extension = {
  nodes: [
    {
      name: 'hard_break',
      spec: {
        inline: true,
        group: 'inline',
        selectable: false,
        parseDOM: [{ tag: 'br' }],
        toDOM() {
          return ['br'];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.LineBreak,
            node: 'hard_break',
          },
        ],
        writer: (output: PandocOutput) => {
          output.writeToken(PandocTokenType.LineBreak);
        },
      },
    },
  ],

  baseKeys: () => {
    return [
      { key: BaseKey.ModEnter, command: hardBreakCommandFn() },
      { key: BaseKey.ShiftEnter, command: hardBreakCommandFn() },
    ];
  },
};

export function hardBreakCommandFn() {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const br = state.schema.nodes.hard_break;
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
    }
    return true;
  };
}

export default extension;
