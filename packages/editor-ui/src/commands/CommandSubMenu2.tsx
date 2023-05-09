/*
 * CommandSubMenu2.tsx
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

import React, { PropsWithChildren, useContext } from 'react';

import { SubMenuProps2, SubMenu2 } from '../menu/Menu2';

import { CommandMenuItem2 } from './CommandMenuItem2';

import { CommandManagerContext, Commands } from './CommandManager';

export interface CommandSubMenuProps2 extends SubMenuProps2 {
  commands?: Commands;
}

export const CommandSubMenu2: React.FC<PropsWithChildren<CommandSubMenuProps2>> = props => {
  // get command manager for command lookup
  const [cmState] = useContext(CommandManagerContext);


  let haveCommands = false;
  const children = React.Children.toArray(props.children);
  for (const child of children) {

    if (
      React.isValidElement(child) &&
      child.type === CommandMenuItem2 
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
    return <SubMenu2 {...props} />;
  } else {
    return null;
  }
};
