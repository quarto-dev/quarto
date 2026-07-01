/*
 * selection.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Selection, NodeSelection } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { GapCursor } from 'prosemirror-gapcursor';

import { NodeWithPos, setTextSelection } from 'prosemirror-utils';

import { kAddToHistoryTransaction, kRestoreLocationTransaction } from './transaction';
import { editingRootNode } from './node';

export function selectionIsWithin(selection: Selection, nodeWithPos: NodeWithPos) {
  const from = nodeWithPos.pos + 1;
  const to = from + nodeWithPos.node.nodeSize;
  return selectionIsWithinRange(selection, { from, to });
}

export function selectionHasRange(selection: Selection, range: { from: number; to: number }) {
  return selection.from === range.from && selection.to === range.to;
}

export function selectionIsWithinRange(selection: Selection, range: { from: number; to: number }) {
  return selection.anchor >= range.from && selection.anchor <= range.to;
}

export function selectionIsBodyTopLevel(selection: Selection) {
  const { $head } = selection;
  const parentNode = $head.node($head.depth - 1);
  return parentNode && 
         (parentNode.type === parentNode.type.schema.nodes.body ||
          (selection instanceof GapCursor && parentNode.type === parentNode.type.schema.nodes.doc));
}

export function selectionIsImageNode(schema: Schema, selection: Selection) {
  return selection instanceof NodeSelection && [schema.nodes.image, schema.nodes.figure].includes(selection.node.type);
}

export function selectionIsEmptyParagraph(schema: Schema, selection: Selection) {
  const { $head } = selection;
  return $head.parent.type === schema.nodes.paragraph && $head.parent.childCount === 0;
}

export function selectionWithinLastBodyParagraph(selection: Selection) {
  if (selectionIsBodyTopLevel(selection)) {
    const editingRoot = editingRootNode(selection);
    if (editingRoot) {
      const node = selection.$head.node();
      return node === editingRoot.node.lastChild && node.type === node.type.schema.nodes.paragraph;
    }
  }
  return false;
}

export function restoreSelection(view: EditorView, pos: number) {
  const tr = view.state.tr;
  if (pos < view.state.doc.nodeSize) {
    setTextSelection(pos)(tr);
    tr.setMeta(kAddToHistoryTransaction, false);
    tr.setMeta(kRestoreLocationTransaction, true);
    view.dispatch(tr);
  }
}
