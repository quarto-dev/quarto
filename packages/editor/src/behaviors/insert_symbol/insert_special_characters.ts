/*
 * insert_special_characters.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorCommandId, InsertCharacterCommand, ProsemirrorCommand } from '../../api/command';
import { hardBreakCommandFn } from '../../nodes/hard_break';

const extension = {
  commands: () => {
    return [
      new InsertCharacterCommand(EditorCommandId.EmDash, '—', []),
      new InsertCharacterCommand(EditorCommandId.EnDash, '–', []),
      new ProsemirrorCommand(EditorCommandId.HardLineBreak, ['Shift-Enter'], hardBreakCommandFn())
    ];
  },
};

export default extension;
