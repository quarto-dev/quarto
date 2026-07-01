/*
 * math-keys.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { EditorState, Transaction } from "prosemirror-state";
import { setTextSelection } from "prosemirror-utils";

import { MathType, mathTypeIsActive } from "../../api/math";
import { getSelectionMarkRange } from "../../api/mark";

// enable insertion of newlines
export function displayMathNewline(state: EditorState, dispatch?: (tr: Transaction) => void) {
  // display math mark must be active
  if (!mathTypeIsActive(state, MathType.Display)) {
    return false;
  }

  // insert a newline
  if (dispatch) {
    const tr = state.tr;
    tr.insertText('\n');
    dispatch(tr);
  }
  return true;
}

export function inlineMathNav(begin: boolean) {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    // inlne math mark must be active
    if (!mathTypeIsActive(state, MathType.Inline)) {
      return false;
    }
    const range = getSelectionMarkRange(state.selection, state.schema.marks.math);
    if (!range) {
      return false;
    }
  
    // insert a newline
    if (dispatch) {
      const tr = state.tr;
      setTextSelection(begin ? (range.from+1) : (range.to-1))(tr);
      dispatch(tr);
    }
    return true;
  };
}
