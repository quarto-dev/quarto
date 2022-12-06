/*
 * Workbench.tsx
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

import React, { useContext, useEffect, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { HotkeysContext, useHotkeys } from '@blueprintjs/core';

import { CommandManagerContext } from '../commands/CommandManager';
import { commandHotkeys } from '../commands/hotkeys';
import { WorkbenchCommandId } from '../commands/commands';

import EditorPane from '../panes/editor/EditorPane';
import MarkdownPane from '../panes/markdown/MarkdownPane';

import WorkbenchNavbar from './WorkbenchNavbar';
import WorkbenchClipboard from './WorkbenchClipboard';

import { EditorDialogsProvider } from '../panes/editor/dialogs/EditorDialogsProvider';
import { WorkbenchPrefsDialog } from './WorkbenchPrefsDialog';
import WorkbenchToolbar from './WorkbenchToolbar';

import './Workbench.scss';
import WorkbenchTestDialog from './WorkbenchTestDialog';

const Workbench: React.FC = () => {
 
  const { t } = useTranslation();
  const [cmState, cmDispatch] = useContext(CommandManagerContext);

  // register hotkeys
  const hotkeys = useMemo(() => {
    return commandHotkeys(cmState.commands);
  }, [cmState.commands]);
  const { handleKeyDown, handleKeyUp } = useHotkeys(hotkeys, { showDialogKeyCombo: 'Ctrl+Alt+?' });

  // hotkeys command
  const [, hkDispatch] = useContext(HotkeysContext);
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.KeyboardShortcuts,
        menuText: t('commands:keyboard_shortcuts_menu_text'),
        group: t('commands:group_utilities'),
        keymap: ['Ctrl+Alt+K'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          hkDispatch({ type: "OPEN_DIALOG"});
        },
      },
    ]});
  }, []); 

  // render workbench
  return (
    <div className={'workbench'} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      <WorkbenchNavbar />
      <WorkbenchToolbar />
      <div className={'workspace'}>
        <EditorDialogsProvider>
          <EditorPane />
        </EditorDialogsProvider>
        <MarkdownPane />
      </div>
      <WorkbenchClipboard />
      <WorkbenchPrefsDialog />
      <WorkbenchTestDialog />
    </div>
  );
};

export default Workbench;
