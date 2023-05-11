/*
 * Toolbar2.tsx
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

import React, { PropsWithChildren } from "react"

import { 
  Toolbar as FluentToolbar,
  ToolbarButton as FluentToolbarButton,
  ToolbarDivider as FluentToolbarDivider,
  Slot, 
} from "@fluentui/react-components";
import { useMenuStyles } from "./styles";


export interface Toolbar2Props {
  className?: string;
}


export const Toolbar2: React.FC<PropsWithChildren<Toolbar2Props>> = props => {
  const classes = useMenuStyles();
  let toolbarClasses = classes.toolbar;
  if (props.className) {
    toolbarClasses = `${toolbarClasses} ${props.className}`; 
  }
  return (
    <FluentToolbar size="small" className={toolbarClasses}>
      {props.children}
    </FluentToolbar>
  );
};

export interface ToolbarButtonProps2 {
  icon?: Slot<"span">;
  title: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}

export const ToolbarButton2: React.FC<ToolbarButtonProps2> = props => {
  const classes = useMenuStyles();
  return (
    <FluentToolbarButton
      className={props.active ? classes.toolbarButtonLatched : undefined }
      title={props.title}
      appearance={"subtle"}
      icon={props.icon}
      disabled={!props.enabled}
      onClick={props.onClick}
    />
  );
};

export const ToolbarDivider2: React.FC = () => {
  return <FluentToolbarDivider  />
}
