/*
 * hotkeys.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */



import { HotkeyConfig } from "ui-widgets";

import { Commands } from "./CommandManager";
import { Command } from "./commands";

export function commandHotkeys(commands: Commands) : HotkeyConfig[] {

  // map keys to commands
  const hotkeys: { [key: string]: Command } = {};
  Object.values(commands).forEach(command => {
    if (command) {
      if (!command.keysHidden && command.keymap) {
        command.keymap.forEach(keyCombo => {
          hotkeys[keyCombo] = command;
        });
      }
    }
  });

  // return hotkeys
  return Object.keys(hotkeys).map(key => {
    const command = hotkeys[key];
    const handler = command.keysUnbound
      ? undefined
      : () => {
          if (command.isEnabled()) {
            command.execute();
          }
        };
    // normalize to HotkeyConfig format
    const combo = key.toLowerCase().replace(/-/g, ' + ');
    return {
      global: true,
      group: command.group,
      key,
      allowInInput: true,
      combo,
      label: command.menuText,
      onKeyDown: handler,
      preventDefault: !command.keysUnbound,
      stopPropagation: !command.keysUnbound
    }
  });
}