/*
 * superscript.ts
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
      name: 'superscript',
      spec: {
        group: 'formatting',
        parseDOM: [{ tag: 'sup' }],
        toDOM() {
          return ['sup'];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.Superscript,
            mark: 'superscript',
          },
        ],
        writer: {
          priority: 15,
          write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
            output.writeMark(PandocTokenType.Superscript, parent);
          },
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [new MarkCommand(EditorCommandId.Superscript, [], schema.marks.superscript)];
  },

  inputRules: (schema: Schema, filter: MarkInputRuleFilter) => {
    return [delimiterMarkInputRule('\\^', schema.marks.superscript, filter, '`', true)];
  },
};

export default extensionIfEnabled(extension, 'superscript');
