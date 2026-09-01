/*
 * CommandMenuItem2.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import React, { useContext } from 'react';

import {
  Checkmark16Filled, 
  Checkmark16Regular,
  bundleIcon
} from "@fluentui/react-icons"

const CheckmarkIcon = bundleIcon(Checkmark16Filled, Checkmark16Regular);


import { keyCodeString } from './keycodes';
import { commandKeymapText } from './commands';
import { CommandManagerContext, Commands } from 'editor-ui';
import { MenuItem } from '@fluentui/react-components';
import { useMenuStyles } from '../menu/styles';

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

  const classes = useMenuStyles();

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

    const isActive = active === 'latch' ? command.isActive() : false;

    return (
      <MenuItem 
        key={command.id}
        className={classes.item}
        secondaryContent={label}
        icon={isActive ? <CheckmarkIcon /> : undefined}
        disabled={!command.isEnabled()} 
        onClick={command.execute}
      >
        {props.text || command.menuText}
      </MenuItem>
    );
  } else {
    return null;
  }
};
