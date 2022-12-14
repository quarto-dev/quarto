/*
 * CommandMenuItem.tsx
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


import React, { useContext } from 'react';

import { MenuItem } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';

import { keyCodeString } from './keycodes';
import { commandKeymapText } from './commands';
import { CommandManagerContext, Commands } from 'editor-ui';

export enum CommandMenuItemActive {
  Check = 'check',
  Latch = 'latch',
  None = 'none',
}

export interface CommandMenuItemProps {
  id: string;
  text?: string;
  keyCode?: string;
  active?: CommandMenuItemActive;
  commands?: Commands;
}

export const CommandMenuItem: React.FC<CommandMenuItemProps> = props => {
  const { id, keyCode, active = CommandMenuItemActive.None } = props;

  // force re-render when the selection changes
  const [cmState] = useContext(CommandManagerContext);
  
  // get command
  let command = props.commands?.[id];
  if (!command) {
    command = cmState.commands[id];
  }
  
  if (command) {
    // resolve label
    const label = keyCode ? keyCodeString(keyCode, true) : commandKeymapText(command, true);

    // resolve icon
    const icon =
      active === 'check'
        ? command.isActive()
          ? IconNames.SMALL_TICK
          : IconNames.BLANK
        : command.icon || IconNames.BLANK;

    const isActive = active === 'latch' ? command.isActive() : false;

    return (
      <MenuItem
        icon={icon}
        text={props.text || command.menuText}
        onClick={command.execute}
        active={isActive}
        disabled={!command.isEnabled()}
        label={label}
      />
    );
  } else {
    return null;
  }
};
