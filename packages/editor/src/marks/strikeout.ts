/*
 * strikeout.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Schema, Mark, Fragment } from 'prosemirror-model';

import { MarkCommand, EditorCommandId } from '../api/command';
import { Extension, extensionIfEnabled } from '../api/extension';
import { PandocOutput, PandocTokenType } from '../api/pandoc';
import { delimiterMarkInputRule, MarkInputRuleFilter } from '../api/input_rule';

const extension: Extension = {
  marks: [
    {
      name: 'strikeout',
      spec: {
        group: 'formatting',
        parseDOM: [
          { tag: 'del' },
          { tag: 's' },
          {
            style: 'text-decoration',
            getAttrs: (value: string | Node) => (value as string) === 'line-through' && null,
          },
        ],
        toDOM() {
          return ['del'];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.Strikeout,
            mark: 'strikeout',
          },
        ],
        writer: {
          priority: 6,
          write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
            output.writeMark(PandocTokenType.Strikeout, parent);
          },
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [new MarkCommand(EditorCommandId.Strikeout, [], schema.marks.strikeout)];
  },

  inputRules: (schema: Schema, filter: MarkInputRuleFilter) => {
    return [delimiterMarkInputRule('~~', schema.marks.strikeout, filter, '`', true)];
  },
};

export default extensionIfEnabled(extension, 'strikeout');
