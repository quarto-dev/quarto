/*
 * smarty.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { InputRule } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';

import { Extension, extensionIfEnabled } from '../api/extension';


// match enDash but only for lines that aren't an html comment
const enDash = new InputRule(/[^!-`]--$/, (state: EditorState, _match: string[], _start: number, end: number) => {
  const { parent, parentOffset } = state.selection.$head;
  const precedingText = parent.textBetween(0, parentOffset);
  if (precedingText.indexOf('<!--') === -1) {
    const tr = state.tr;
    tr.insertText('–', end - 1, end);
    return tr;
  } else {
    return null;
  }
});

const emDash = new InputRule(/(^|[^`])–-$/, (state: EditorState, _match: string[], _start: number, end: number) => {
  const tr = state.tr;
  tr.insertText('—', end - 1, end);
  return tr;
});

const extension: Extension = {
  inputRules: () => {
    return [enDash, emDash];
  }
};

export default extensionIfEnabled(extension, 'smart');
