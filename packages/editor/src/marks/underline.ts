/*
 * underline.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Schema, Mark, Fragment } from 'prosemirror-model';

import { MarkCommand, EditorCommandId } from '../api/command';
import { Extension, extensionIfEnabled } from '../api/extension';
import { PandocOutput, PandocTokenType } from '../api/pandoc';

import './underline-styles.css';
import { kPlatformMac } from '../api/platform';

const extension: Extension = {
  marks: [
    {
      name: 'underline',
      spec: {
        parseDOM: [
          { tag: "span[class*='underline']" },
          { tag: "span[class*='ul']" },
          { tag: "u" },
          { tag: "ins" }
        ],
        toDOM() {
          return ['span', { class: 'underline' }];
        },
      },
      pandoc: {
        readers: [
          {
            token: PandocTokenType.Underline,
            mark: 'underline',
          },
        ],
        writer: {
          priority: 7,
          write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
            output.writeMark(PandocTokenType.Underline, parent);
          },
        },
      },
    },
  ],

  commands: (schema: Schema) => {
    return [new MarkCommand(EditorCommandId.Underline, kPlatformMac ? ['Mod-u'] : [], schema.marks.underline)];
  },
};

export default extensionIfEnabled(extension, ['bracketed_spans', 'native_spans']);
