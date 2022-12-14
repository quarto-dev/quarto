/*
 * WorkbenchMenubar.tsx
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

import React, { useContext } from 'react';

import { ButtonGroup, MenuDivider } from '@blueprintjs/core';

import { EditorCommandId } from 'editor';

import { t } from "editor-ui"

import { 
  MainMenu, 
  MenubarMenu, 
  WithCommand, 
  CommandMenuItem, 
  CommandMenuItemActive, 
  CommandManagerContext, 
  CommandMenubarMenu, 
  EditorUICommandId
} from 'editor-ui';

import { WorkbenchCommandId } from './commands';

import styles from './WorkbenchMenubar.module.scss';


const CommandId = { ...EditorCommandId,  ...EditorUICommandId, ...WorkbenchCommandId };

const FileMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={CommandId.Rename} />
    </MenubarMenu>
  );
};

const EditMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={CommandId.Undo} />
      <CommandMenuItem id={CommandId.Redo} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.Cut} />
      <CommandMenuItem id={CommandId.Copy} />
      <CommandMenuItem id={CommandId.Paste} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.SelectAll} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.Find} />
      <CommandMenuItem id={CommandId.FindNext} />
      <CommandMenuItem id={CommandId.FindPrevious} />
      <CommandMenuItem id={CommandId.ReplaceAndFind} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.Prefs} />
    </MenubarMenu>
  );
};

const ViewMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={CommandId.ShowOutline} active={CommandMenuItemActive.Check} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.ActivateEditor} />
    </MenubarMenu>
  );
};

const HelpMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={CommandId.EnableDevTools} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.KeyboardShortcuts} />
    </MenubarMenu>
  );
};

const WorkbenchMenubar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);

  return (
    <ButtonGroup className={styles.menubarButtons} minimal={true}>
      <MainMenu text={t('file_menu')} menu={<FileMenu />} />
      <MainMenu text={t('edit_menu')} menu={<EditMenu />} />
      <MainMenu text={t('view_menu')} menu={<ViewMenu />} />
      <MainMenu text={t('insert_menu')} menu={<CommandMenubarMenu menu={cmState.menus.insert} />} />
      <MainMenu text={t('format_menu')} menu={<CommandMenubarMenu menu={cmState.menus.format} />} />
      <WithCommand id={CommandId.TableInsertTable}>
        <MainMenu text={t('table_menu')} menu={<CommandMenubarMenu menu={cmState.menus.table} />} />
      </WithCommand>
      <MainMenu text={t('help_menu')} menu={<HelpMenu />} />
    </ButtonGroup>
  );
};

export default WorkbenchMenubar;
