/*
 * paragraph.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Node as ProsemirrorNode, Schema } from 'prosemirror-model';

import { BlockCommand, EditorCommandId, ProsemirrorCommand } from '../api/command';
import { Extension } from '../api/extension';
import { PandocOutput, PandocTokenType } from '../api/pandoc';
import { insertParagraph } from '../api/paragraph';
import { emptyNodePlaceholderPlugin } from '../api/placeholder';
import { selectionWithinLastBodyParagraph } from '../api/selection';

const extension: Extension = {
  nodes: [
    {
      name: 'paragraph',
      spec: {
        content: 'inline*',
        group: 'block list_item_block',
        parseDOM: [{ tag: 'p' }],
        toDOM() {
          return ['p', 0];
        },
      },
      pandoc: {
        readers: [
          { token: PandocTokenType.Para, block: 'paragraph' },
          { token: PandocTokenType.Plain, block: 'paragraph' },
        ],
        writer: (output: PandocOutput, node: ProsemirrorNode) => {
          output.writeToken(PandocTokenType.Para, () => {
            output.writeInlines(node.content);
          });
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [
      new BlockCommand(EditorCommandId.Paragraph, ['Mod-Alt-0'], schema.nodes.paragraph, schema.nodes.paragraph),
      new InsertParagraphCommand(),
    ];
  },

  plugins: (schema: Schema) => {
    let hints = 1;
    return [emptyNodePlaceholderPlugin(schema.nodes.paragraph, () => " type / to insert a block (code, math, figure, div, etc.)", tr => {
      if (hints > 0) {
        if (selectionWithinLastBodyParagraph(tr.selection)) {
          if (tr.docChanged) {
            hints--;
            return true;
          } else {
            return false;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    })];
  },
};

class InsertParagraphCommand extends ProsemirrorCommand {
  constructor() {
    super(EditorCommandId.ParagraphInsert, [], insertParagraph);
  }
}

export default extension;
