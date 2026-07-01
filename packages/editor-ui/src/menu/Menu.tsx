/*
 * Menu2.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { PropsWithChildren } from 'react';

import { 
  Button,
  Menu as FluentMenu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Slot,
  mergeClasses, 
} from "@fluentui/react-components";

import {
  ChevronDown16Filled, 
  ChevronDown16Regular,
  bundleIcon
} from "@fluentui/react-icons"
import { useMenuStyles } from "./styles";

const ChevronDownIcon = bundleIcon(ChevronDown16Filled, ChevronDown16Regular);


export interface MenuProps  {
  type?: "main" | "toolbar";
  icon?: React.JSX.Element;
  text?: string;
  disabled?: boolean;
  minWidth?: number;
}

export const Menu: React.FC<PropsWithChildren<MenuProps>> = props => {

  const classes = useMenuStyles() ;

  const { type = "main" } = props;
  const downArrow = type === "toolbar";

  const classNames = [classes.menuButton];
  if (type === "main") {
    classNames.push(classes.menubarMenuButton);
  }
  const className = mergeClasses(...classNames);
  return (
    <FluentMenu hasIcons={true}>
      <MenuTrigger>
        <Button 
          style={props.minWidth ? { minWidth: props.minWidth + 'px' } : {}}
          className={className} 
          disabled={!!props.disabled} 
          appearance={"subtle"} 
          icon={downArrow ? <ChevronDownIcon/> : undefined} 
          iconPosition="after"
        >
          {props.icon || null}
          {props.text || null}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {props.children}
        </MenuList>
      </MenuPopover>
    </FluentMenu>
  );
  
};

export interface SubMenuProps {
  text: string;
  icon?: Slot<"span">;
}

export const SubMenu: React.FC<PropsWithChildren<SubMenuProps>> = props => {

  const classes = useMenuStyles();

  return (
    <FluentMenu hasIcons={true} openOnHover={true} hoverDelay={0}>
      <MenuTrigger disableButtonEnhancement>
        <MenuItem className={classes.item}>{props.text}</MenuItem>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {props.children}
        </MenuList>
      </MenuPopover>
    </FluentMenu>    
  );
};

