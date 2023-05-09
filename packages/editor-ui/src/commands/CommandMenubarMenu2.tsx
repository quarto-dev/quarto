/*
 * CommandMenubarMenu.tsx
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


import React from "react";

import { EditorMenuItem } from "editor-types";

import { CommandMenuItems2 } from "./CommandMenuItems2";
import { Menu2 } from "../menu/Menu2";

export interface CommandMenubarMenuProps2 {
  text: string;
  menu: EditorMenuItem[];
}

export const CommandMenubarMenu2: React.FC<CommandMenubarMenuProps2> = (props) => {
  return (
    <Menu2 text={props.text}>
      <CommandMenuItems2 {...props}/>
    </Menu2>
  )

};


