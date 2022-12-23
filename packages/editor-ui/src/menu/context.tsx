/*
 * context.ts
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

import { ContextMenu, Menu, MenuDivider, MenuItem } from "@blueprintjs/core";

import { v4 as uuidv4 } from 'uuid';

import { EditorMenuItem } from "editor-types";
import { CommandMenuItem, Commands } from "editor-ui";

export async function showContextMenu(
  commands: Commands,
  items: EditorMenuItem[],
  clientX: number,
  clientY: number
): Promise<boolean> {
  return new Promise(resolve => {    
    const menuItems = items.map(item => {
      if (item.separator) {
        return <MenuDivider key={uuidv4()}/>;
      } else if (item.command) {
        return <CommandMenuItem id={item.command} key={item.command} text={item.text} commands={commands}/>;
      } else {
        return <MenuItem text={item.text} key={uuidv4()} onClick={item.exec}/>
      }
    });
    ContextMenu.show(<Menu>{menuItems}</Menu>, { left: clientX, top: clientY }, () => {
      resolve(true);
    });
  }); 
}