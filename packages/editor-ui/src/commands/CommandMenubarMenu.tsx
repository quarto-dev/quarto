/*
 * CommandMenubarMenu.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import React from "react";

import { EditorMenuItem } from "editor-types";

import { CommandMenuItems } from "./CommandMenuItems";
import { Menu } from "../menu/Menu";

export interface CommandMenubarMenuProps {
  text: string;
  menu: EditorMenuItem[];
}

export const CommandMenubarMenu: React.FC<CommandMenubarMenuProps> = (props) => {
  return (
    <Menu text={props.text}>
      <CommandMenuItems {...props}/>
    </Menu>
  )

};


