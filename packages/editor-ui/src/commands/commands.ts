/*
 * commands.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { toKeyCode, keyCodeString } from './keycodes';
import { Slot } from '@fluentui/react-components';

export interface Command {
  // unique  id
  readonly id: string;

  // text for menu
  readonly menuText: string;

  // group (for display in keyboard shortcuts dialog)
  readonly group: string;

  // optional fluent icon for toolbar/menu
  readonly icon?: Slot<"span">;

  // keys to bind to
  readonly keymap: readonly string[];

  // don't bind the keys (they are handled by another component e.g. prosemirror)
  readonly keysUnbound?: boolean;

  // don't show the keys in the keyboard shortcuts dialogs
  readonly keysHidden?: boolean;

  // is the command available?
  isEnabled: () => boolean;

  // is it active/latched
  isActive: () => boolean;

  // execute the command
  execute: () => void;
}

export function commandKeymapText(command: Command, pretty: boolean) {
  if (command.keymap.length) {
    const keyCode = toKeyCode(command.keymap[0]);
    return keyCodeString(keyCode, pretty);
  } else {
    return '';
  }
}

export function commandTooltipText(command: Command) {
  let text = command.menuText;
  const keymapText = commandKeymapText(command, true);
  if (keymapText) {
    text = `${text} (${keymapText})`;
  }
  return text;
}
