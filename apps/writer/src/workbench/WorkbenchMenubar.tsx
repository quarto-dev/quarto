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
import { useTranslation } from 'react-i18next';

import { ButtonGroup, MenuDivider } from '@blueprintjs/core';

import { EditorCommandId } from 'editor';

import { MainMenu, MenubarMenu } from '../widgets/Menu';
import { WithCommand } from '../widgets/command/WithCommand';
import { CommandMenuItem, CommandMenuItemActive } from '../widgets/command/CommandMenuItem';
import { WorkbenchCommandId } from '../commands/commands';

import { CommandManagerContext } from '../commands/CommandManager';
import { CommandMenubarMenu } from '../widgets/command/CommandMenubarMenu';

import styles from './WorkbenchMenubar.module.scss';

const CommandId = { ...EditorCommandId, ...WorkbenchCommandId };

const FileMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={WorkbenchCommandId.Rename} />
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
      <CommandMenuItem id={WorkbenchCommandId.Prefs} />
    </MenubarMenu>
  );
};

const ViewMenu: React.FC = () => {
  return (
    <MenubarMenu>
      <CommandMenuItem id={WorkbenchCommandId.ShowOutline} active={CommandMenuItemActive.Check} />
      <CommandMenuItem id={WorkbenchCommandId.ShowMarkdown} active={CommandMenuItemActive.Check} />
      <MenuDivider />
      <CommandMenuItem id={WorkbenchCommandId.ActivateEditor} />
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
  const { t } = useTranslation();

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
