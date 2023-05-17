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

import { MenuDivider } from '@fluentui/react-components';

import { EditorCommandId } from 'editor';

import { 
  t,
  WithCommand, 
  CommandManagerContext,  
  EditorUICommandId,
  CommandMenuItem,
  CommandMenuItemActive,
  CommandMenubarMenu,
  Menu,

} from 'editor-ui';

import { WorkbenchCommandId } from './commands';


const CommandId = { ...EditorCommandId,  ...EditorUICommandId, ...WorkbenchCommandId };


const FileMenu: React.FC = () => {
  return (
    <Menu text={t('file_menu') as string}>
     
    </Menu>
  );
};

const EditMenu: React.FC = () => {
  return (
    <Menu text={t('edit_menu') as string} >
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
    </Menu>
  );
};

const ViewMenu: React.FC = () => {
  return (
    <Menu text={t('view_menu') as string}>
      <CommandMenuItem id={CommandId.ShowOutline} active={CommandMenuItemActive.Check} />
      <MenuDivider />
      <CommandMenuItem id={CommandId.ActivateEditor} />
    </Menu>
  );
};

const HelpMenu: React.FC = () => {
  return (
    <Menu text={t('help_menu') as string}>
      <CommandMenuItem id={CommandId.EnableDevTools} />
    </Menu>
  );
};




const WorkbenchMenubar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);

  return (
    <>
      <FileMenu />
      <EditMenu />
      <ViewMenu />
      
      <CommandMenubarMenu text={t('insert_menu')} menu={cmState.menus.insert} />
      <CommandMenubarMenu text={t('format_menu')} menu={cmState.menus.format} />
      <WithCommand id={CommandId.TableInsertTable}>
        <CommandMenubarMenu text={t('table_menu')} menu={cmState.menus.table} />
      </WithCommand>
      <HelpMenu />
    </>
  );
};

export default WorkbenchMenubar;
