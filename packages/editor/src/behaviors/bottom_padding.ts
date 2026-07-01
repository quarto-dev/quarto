/*
 * bottom_padding.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

import zenscroll from 'zenscroll';

import { Extension } from '../api/extension';
import { selectionWithinLastBodyParagraph } from '../api/selection';
import { EditorView } from 'prosemirror-view';
import { bodyElement } from '../api/dom';
import { findParentNodeOfType } from 'prosemirror-utils';
import { editorScrollContainer } from '../api/scroll';

// when we get close to the bottom, we autoscroll to provide more padding
const kAutoscrollGapPx = 25;

const extension: Extension = {
  plugins: (schema: Schema) => {
    return [
      new Plugin({
        key: new PluginKey('bottom_padding'),
        view: () => ({
          update: (view: EditorView) => {
            const selection = view.state.selection;
            if (selectionWithinLastBodyParagraph(selection)) {
              const paragraphNode = findParentNodeOfType(schema.nodes.paragraph)(selection);
              if (paragraphNode) {
                const paragraphEl = view.nodeDOM(paragraphNode.pos) as HTMLElement;
                const paragraphRect = paragraphEl.getBoundingClientRect();
                const editorEl = view.dom;
                const editorRect = editorEl.getBoundingClientRect();
                if (Math.abs(paragraphRect.bottom - editorRect.bottom) < kAutoscrollGapPx) {
                  const bodyEl = bodyElement(view);
                  const scroller = zenscroll.createScroller(editorScrollContainer(bodyEl));
                  scroller.toY(bodyEl.scrollHeight, 0);
                }
              }
            }
          },
        }),
      }),
    ];
  },
};

export default extension;
