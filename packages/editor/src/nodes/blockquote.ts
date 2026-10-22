/*
 * blockquote.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { wrappingInputRule } from 'prosemirror-inputrules';
import { Node as ProsemirrorNode, Schema, DOMOutputSpec } from 'prosemirror-model';

import { WrapCommand, EditorCommandId } from '../api/command';
import { ExtensionContext } from '../api/extension';
import { PandocOutput, PandocTokenType } from '../api/pandoc';
import { EditorUI } from '../api/ui-types';
import { OmniInsertGroup } from '../api/omni_insert';

const extension = (context: ExtensionContext) => {
  const { ui } = context;

  return {
    nodes: [
      {
        name: 'blockquote',
        spec: {
          content: 'block+',
          group: 'block',
          defining: true,
          parseDOM: [{ tag: 'blockquote' }],
          toDOM(): DOMOutputSpec {
            return ['blockquote', { class: 'pm-blockquote pm-block-border-color' }, 0];
          },
        },
        pandoc: {
          readers: [
            {
              token: PandocTokenType.BlockQuote,
              block: 'blockquote',
            },
          ],
          writer: (output: PandocOutput, node: ProsemirrorNode) => {
            output.writeToken(PandocTokenType.BlockQuote, () => {
              output.writeNodes(node);
            });
          },
        },
      },
    ],

    commands: (schema: Schema) => {
      return [new WrapCommand(EditorCommandId.Blockquote, [], schema.nodes.blockquote, {}, blockquoteOmniInsert(ui))];
    },

    inputRules: (schema: Schema) => {
      return [wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote)];
    },
  };
};

function blockquoteOmniInsert(ui: EditorUI) {
  return {
    name: ui.context.translateText('Blockquote'),
    description: ui.context.translateText('Section quoted from another source'),
    group: OmniInsertGroup.Blocks,
    priority: 8,
    image: () => (ui.prefs.darkMode() ? ui.images.omni_insert.blockquote_dark : ui.images.omni_insert.blockquote),
  };
}

export default extension;
