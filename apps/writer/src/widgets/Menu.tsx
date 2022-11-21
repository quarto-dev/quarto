/*
 * Menu.tsx
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

import React, { PropsWithChildren } from 'react';

import { Props, Position, Button, Menu, MenuItem } from '@blueprintjs/core';
import { Popover2 } from '@blueprintjs/popover2';
import { IconNames, IconName } from '@blueprintjs/icons';

import styles from './Menu.module.scss';

export interface MainMenuProps extends Props {
  text: string;
  menu: JSX.Element;
}

export const MainMenu: React.FC<MainMenuProps> = props => {
  return (
    <Popover2
      autoFocus={false}
      minimal={true}
      inheritDarkTheme={false}
      content={props.menu}
      position={Position.BOTTOM_LEFT}
    >
      <Button className={styles.button}>{props.text}</Button>
    </Popover2>
  );
};

export const MenubarMenu: React.FC<PropsWithChildren<Props>> = props => {
  return <Menu className={styles.menubarMenu}>{props.children}</Menu>;
};

export interface SubMenuProps extends Props {
  text: string;
  icon?: IconName;
}

export const SubMenu: React.FC<PropsWithChildren<SubMenuProps>> = props => {
  return (
    <MenuItem text={props.text} icon={props.icon || IconNames.BLANK}>
      {props.children}
    </MenuItem>
  );
};
