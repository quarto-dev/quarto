/*
 * list.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';
import { Transaction, Selection } from 'prosemirror-state';

import { findParentNodeOfType, setTextSelection } from 'prosemirror-utils';


export function isList(node: ProsemirrorNode | null | undefined) {
  if (node) {
    const schema = node.type.schema;
    return node.type === schema.nodes.bullet_list || node.type === schema.nodes.ordered_list;
  } else {
    return false;
  }
}

export function precedingListItemInsertPos(doc: ProsemirrorNode, selection: Selection) {
  // selection just be empty
  if (!selection.empty) {
    return null;
  }

  // check for insert position in preceding list item (only trigger when
  // the user is at the very beginning of a new bullet)
  const schema = doc.type.schema;
  const $head = selection.$head;
  const parentListItem = findParentNodeOfType(schema.nodes.list_item)(selection);
  if (parentListItem) {
    const $liPos = doc.resolve(parentListItem.pos);
    const listIndex = $liPos.index();
    const parentIndex = $head.index($head.depth - 1);
    const parentOffset = $head.parentOffset;
    if (listIndex > 0 && parentIndex === 0 && parentOffset === 0) {
      const pos = $liPos.pos - 1;
      return pos;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

export function precedingListItemInsert(tr: Transaction, pos: number, node: ProsemirrorNode) {
  tr.deleteRange(tr.selection.from, tr.selection.from + 1);
  tr.insert(pos, node);
  setTextSelection(tr.mapping.map(pos), -1)(tr);
  return tr;
}
