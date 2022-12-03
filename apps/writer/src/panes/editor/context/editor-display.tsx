/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * editor-display.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React from "react";

import { v4 as uuidv4 } from 'uuid';

import { ContextMenu, Menu, MenuDivider, MenuItem } from "@blueprintjs/core";
import { EditorDisplay, EditorMenuItem, XRef } from "editor";

import { Commands } from "../../../commands/CommandManager";
import { CommandMenuItem } from "../../../widgets/command/CommandMenuItem";
import { CommandId } from "../../../commands/commands";


export function editorDisplay(commands: () => Commands) : EditorDisplay {
  return {
    openURL(_url: string) {
      //
    },
    navigateToXRef(_file: string, _xref: XRef) {
      //
    },
    navigateToFile(_file: string) {
      //
    },

    async showContextMenu(
      items: EditorMenuItem[],
      clientX: number,
      clientY: number
    ): Promise<boolean> {
      return new Promise(resolve => {    
        const cmds = commands();
        const menuItems = items.map(item => {
          if (item.separator) {
            return <MenuDivider key={uuidv4()}/>;
          } else if (item.command) {
            return <CommandMenuItem id={item.command as CommandId} key={item.command} text={item.text} commands={cmds}/>;
          } else {
            return <MenuItem text={item.text} key={uuidv4()} onClick={item.exec}/>
          }
        });
        ContextMenu.show(<Menu>{menuItems}</Menu>, { left: clientX, top: clientY }, () => {
          resolve(true);
        });
      }); 
    }
  };
}
