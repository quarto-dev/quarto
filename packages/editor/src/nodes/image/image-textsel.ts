/*
 * image-textsel.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { EditorState, Transaction, NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';
import { nodeDecoration } from '../../api/decoration';

const pluginKey = new PluginKey('image-text-selection');

export function imageTextSelectionPlugin() {
  return new Plugin<DecorationSet>({
    key: pluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr: Transaction, _value: DecorationSet, _oldState: EditorState, newState: EditorState) {
        // no decorations for empty or node selection
        if (tr.selection.empty || tr.selection instanceof NodeSelection) {
          return DecorationSet.empty;
        }

        const schema = newState.schema;
        const decorations: Decoration[] = [];
        tr.doc.nodesBetween(tr.selection.from, tr.selection.to, (node, pos) => {
          if ([schema.nodes.image, schema.nodes.figure].includes(node.type)) {
            decorations.push(nodeDecoration({ node, pos }, { class: 'pm-image-text-selection' }));
          }
        });

        return DecorationSet.create(tr.doc, decorations);
      },
    },
    props: {
      decorations(state: EditorState) {
        return pluginKey.getState(state);
      },
    },
  });
}
