/*
 * table.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorCommandId } from './command';
import { EditorUI } from './ui-types';

export type { TableCapabilities } from 'editor-types';

export function tableMenu(insert: boolean, ui: EditorUI) {
  return [
    ...(insert 
      ? [{ command: EditorCommandId.TableInsertTable }, 
         { separator: true }
      ] 
      : []
    ),
    { command: EditorCommandId.TableAddRowBefore },
    { command: EditorCommandId.TableAddRowAfter },
    { separator: true },
    { command: EditorCommandId.TableAddColumnBefore },
    { command: EditorCommandId.TableAddColumnAfter },
    { separator: true },
    { command: EditorCommandId.TableDeleteRow },
    { command: EditorCommandId.TableDeleteColumn },
    { separator: true },
    { command: EditorCommandId.TableDeleteTable },
    { separator: true },
    {
      text: ui.context.translateText('Align Column'),
      subMenu: {
        items: [
          { command: EditorCommandId.TableAlignColumnLeft },
          { command: EditorCommandId.TableAlignColumnCenter },
          { command: EditorCommandId.TableAlignColumnRight },
          { separator: true },
          { command: EditorCommandId.TableAlignColumnDefault },
        ],
      },
    },
    { separator: true },
    { command: EditorCommandId.TableToggleHeader },
    { command: EditorCommandId.TableToggleCaption },
  ];
}
