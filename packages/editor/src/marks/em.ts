/*
 * em.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Schema, Mark, Fragment } from 'prosemirror-model';

import { MarkCommand, EditorCommandId } from '../api/command';
import { Extension } from '../api/extension';
import { PandocOutput, PandocTokenType } from '../api/pandoc';
import { delimiterMarkInputRule, MarkInputRuleFilter } from '../api/input_rule';

const extension: Extension = {
  marks: [
    {
      name: 'em',
      spec: {
        group: 'formatting',
        parseDOM: [
          { tag: 'i' },
          { tag: 'em' },
          { style: 'font-weight', getAttrs: (value: string | Node) => (value as string) === 'italic' && null },
        ],
        toDOM() {
          return ['em'];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.Emph,
            mark: 'em',
          },
        ],
        writer: {
          priority: 4,
          write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
            output.writeMark(PandocTokenType.Emph, parent);
          },
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [new MarkCommand(EditorCommandId.Em, ['Mod-i'], schema.marks.em)];
  },

  inputRules: (schema: Schema, filter: MarkInputRuleFilter) => {
    return [
      delimiterMarkInputRule('\\*', schema.marks.em, filter, '\\*-`', true),
      delimiterMarkInputRule('_', schema.marks.em, filter, '\\w_`', true),
    ];
  },
};

export default extension;
