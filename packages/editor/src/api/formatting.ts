/*
 * formatting.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';
import { Transaction } from 'prosemirror-state';
import { Transform, liftTarget } from 'prosemirror-transform';
import { trTransform } from './transaction';

// marks included in clear formatting
const kFormattingMarks = ['code', 'em', 'underline', 'smallcaps', 'span', 'strikeout', 'strong', 'superscript', 'subscript'];

// for nodes, all nodes with isTextblock === true will be converted to paragraph, and all
// nodes in this list will be lifted
const kLiftFormattingNodes = ['blockquote', 'line_block', 'div', 'raw_block'];

export function clearFormatting(transaction: Transaction, from: number, to: number) {

  trTransform(transaction, (tr: Transform) => {
    // alias schema and selection
    const schema = tr.doc.type.schema;

    // clear formatting marks
    kFormattingMarks.forEach((markName) => {
      const mark = schema.marks[markName];
      if (mark) {
        tr.removeMark(from, to, mark);
      }
    });

    // lift / set nodes as required
    tr.doc.nodesBetween(from, to, (node: ProsemirrorNode, pos: number) => {
      // ignore paragraph and text nodes (already have 'cleared' formatting)
      if (
        node.type === schema.nodes.paragraph ||
        node.type === schema.nodes.text
      ) {
        return;
      }

      // pass recursively through list container nodes
      if (
        node.type === schema.nodes.bullet_list ||
        node.type === schema.nodes.ordered_list ||
        node.type === schema.nodes.definition_list ||
        node.type === schema.nodes.definition_list_term ||
        node.type === schema.nodes.definition_list_description
      ) {
        return;
      }

      // get node range (map positions)
      const fromPos = tr.doc.resolve(tr.mapping.map(pos + 1));
      const toPos = tr.doc.resolve(tr.mapping.map(pos + node.nodeSize - 1));
      const nodeRange = fromPos.blockRange(toPos);

      // process text blocks and blocks that can be lifted (e.g. blockquote)
      if (nodeRange) {
        if (node.type.isTextblock) {
          tr.setNodeMarkup(nodeRange.start, schema.nodes.paragraph);
        } else if (kLiftFormattingNodes.includes(node.type.name)) {
          const targetLiftDepth = liftTarget(nodeRange);
          if (targetLiftDepth || targetLiftDepth === 0) {
            tr.lift(nodeRange, targetLiftDepth);
          }
        }
      }
    });
  });

  transaction.setStoredMarks([]);
  
  return transaction;
}
