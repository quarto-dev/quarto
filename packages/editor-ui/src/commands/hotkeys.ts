/*
 * hotkeys.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { HotkeyConfig, HotkeysContext, useHotkeys } from "@blueprintjs/core";
import { useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CommandManagerContext, Commands } from "./CommandManager";
import { Command } from "./commands";
import { EditorUICommandId } from "./commands-ui";
import { toBlueprintHotkeyCombo } from "./keycodes";

export function useEditorHotkeys() {
  
  const { t } = useTranslation();
  const [cmState, cmDispatch] = useContext(CommandManagerContext);

  // register hotkeys command
  const [, hkDispatch] = useContext(HotkeysContext);
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: EditorUICommandId.KeyboardShortcuts,
        menuText: t('commands:keyboard_shortcuts_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Ctrl+Alt+K'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          hkDispatch({ type: "OPEN_DIALOG"});
        },
      },
    ]});
  }, []); 


  // register hotkeys and return handlers
  const hotkeys = useMemo(() => {
    return commandHotkeys(cmState.commands);
  }, [cmState.commands]);
  return useHotkeys(hotkeys, { showDialogKeyCombo: 'Ctrl+Alt+K' });
}

function commandHotkeys(commands: Commands) : HotkeyConfig[] {

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
    const combo = toBlueprintHotkeyCombo(key);
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