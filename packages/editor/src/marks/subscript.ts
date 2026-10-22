/*
 * subscript.ts
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
      name: 'subscript',
      spec: {
        group: 'formatting',
        parseDOM: [{ tag: 'sub' }],
        toDOM() {
          return ['sub'];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.Subscript,
            mark: 'subscript',
          },
        ],
        writer: {
          priority: 15,
          write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
            output.writeMark(PandocTokenType.Subscript, parent);
          },
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [new MarkCommand(EditorCommandId.Subscript, [], schema.marks.subscript)];
  },

  inputRules: (schema: Schema, filter: MarkInputRuleFilter) => {
    return [delimiterMarkInputRule('\\~', schema.marks.subscript, filter, '`\\~-', true)];
  },
};

export default extensionIfEnabled(extension, 'subscript');
