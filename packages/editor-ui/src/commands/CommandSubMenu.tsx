/*
 * CommandSubMenu2.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { PropsWithChildren, useContext } from 'react';

import { SubMenuProps, SubMenu } from '../menu/Menu';

import { CommandMenuItem } from './CommandMenuItem';

import { CommandManagerContext, Commands } from './CommandManager';

export interface CommandSubMenuProps extends SubMenuProps {
  commands?: Commands;
}

export const CommandSubMenu: React.FC<PropsWithChildren<CommandSubMenuProps>> = props => {
  // get command manager for command lookup
  const [cmState] = useContext(CommandManagerContext);


  let haveCommands = false;
  const children = React.Children.toArray(props.children);
  for (const child of children) {

    if (
      React.isValidElement(child) &&
      child.type === CommandMenuItem 
    ) {
      // get command
      let command = props.commands?.[child.props.id];
      if (!command) {
        command = cmState.commands[child.props.id];
      }
      if (command) {
        haveCommands = true;
        break;
      }
    }
  }


  if (haveCommands) {
    return <SubMenu {...props} />;
  } else {
    return null;
  }
};
