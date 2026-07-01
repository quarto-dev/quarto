/*
 * paragraph.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorState, Transaction } from 'prosemirror-state';
import { Node as ProsemirrorNode } from 'prosemirror-model';

import { setTextSelection } from 'prosemirror-utils';

import { canInsertNode } from './node';

export function insertParagraph(state: EditorState, dispatch?: (tr: Transaction) => void) {
  const schema = state.schema;

  if (!canInsertNode(state, schema.nodes.paragraph)) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    tr.replaceSelectionWith(schema.nodes.paragraph.create());
    setTextSelection(state.selection.from + 1, 1)(tr);
    dispatch(tr);
  }

  return true;
}

export function isParagraphNode(node: ProsemirrorNode | null | undefined) {
  if (node) {
    const schema = node.type.schema;
    return node.type === schema.nodes.paragraph;
  } else {
    return false;
  }
}
