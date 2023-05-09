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
  CommandMenuItem2,
  CommandMenuItemActive2,
  CommandMenubarMenu2,
  Menu2,

} from 'editor-ui';

import { WorkbenchCommandId } from './commands';


const CommandId = { ...EditorCommandId,  ...EditorUICommandId, ...WorkbenchCommandId };


const FileMenu: React.FC = () => {
  return (
    <Menu2 text={t('file_menu') as string}>
      <CommandMenuItem2 id={CommandId.Rename} />
    </Menu2>
  );
};

const EditMenu: React.FC = () => {
  return (
    <Menu2 text={t('edit_menu') as string} >
      <CommandMenuItem2 id={CommandId.Undo} />
      <CommandMenuItem2 id={CommandId.Redo} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.Cut} />
      <CommandMenuItem2 id={CommandId.Copy} />
      <CommandMenuItem2 id={CommandId.Paste} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.SelectAll} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.Find} />
      <CommandMenuItem2 id={CommandId.FindNext} />
      <CommandMenuItem2 id={CommandId.FindPrevious} />
      <CommandMenuItem2 id={CommandId.ReplaceAndFind} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.Prefs} />
    </Menu2>
  );
};

const ViewMenu: React.FC = () => {
  return (
    <Menu2 text={t('view_menu') as string}>
      <CommandMenuItem2 id={CommandId.ShowOutline} active={CommandMenuItemActive2.Check} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.ActivateEditor} />
    </Menu2>
  );
};

const HelpMenu: React.FC = () => {
  return (
    <Menu2 text={t('help_menu') as string}>
      <CommandMenuItem2 id={CommandId.EnableDevTools} />
      <MenuDivider />
      <CommandMenuItem2 id={CommandId.KeyboardShortcuts} />
    </Menu2>
  );
};




const WorkbenchMenubar: React.FC = () => {

  const [cmState] = useContext(CommandManagerContext);

  return (
    <>
      <FileMenu />
      <EditMenu />
      <ViewMenu />
      
      <CommandMenubarMenu2 text={t('insert_menu')} menu={cmState.menus.insert} />
      <CommandMenubarMenu2 text={t('format_menu')} menu={cmState.menus.format} />
      <WithCommand id={CommandId.TableInsertTable}>
        <CommandMenubarMenu2 text={t('table_menu')} menu={cmState.menus.table} />
      </WithCommand>
      <HelpMenu />
    </>
  );
};

export default WorkbenchMenubar;
