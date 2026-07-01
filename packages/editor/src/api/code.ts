/*
 * code.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Plugin, PluginKey } from 'prosemirror-state';

import { canInsertNodeAtPos } from './node';
import { ResolvedPos, Slice, Fragment } from 'prosemirror-model';
import { CodeViewOptions } from './codeview'

export const kCodeAttr = 0;
export const kCodeText = 1;

export function codeNodeSpec() {
  return {
    content: 'text*',
    group: 'block',
    marks: '',
    code: true,
    defining: true,
    isolating: true,
  };
}

export function codeViewClipboardPlugin(codeViews: { [key: string]: CodeViewOptions }) {
  return new Plugin({
    key: new PluginKey('code-view-clipboard'),
    props: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clipboardTextParser: (text: string, $context: ResolvedPos) : any => {
        // see if any of the code views want to handle this text
        for (const codeViewType of Object.keys(codeViews)) {
          const codeView = codeViews[codeViewType];
          if (codeView.createFromPastePattern && codeView.createFromPastePattern.test(text)) {
            const schema = $context.node().type.schema;
            const nodeType = schema.nodes[codeViewType];
            if (canInsertNodeAtPos($context, nodeType)) {
              const textNode = schema.text(text);
              const codeNode = nodeType.createAndFill({}, textNode);
              return new Slice(Fragment.from(codeNode), 0, 0);
            }
          }
        }
        return null;
      },
    },
  });
}
