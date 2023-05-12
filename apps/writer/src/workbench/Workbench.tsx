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

import { HotkeysContext, useHotkeys } from '@blueprintjs/core';

import { FluentProvider, webLightTheme } from '@fluentui/react-components';

import { commandHotkeys, CommandManagerContext, keyboardShortcutsCommand } from 'editor-ui';

import EditorPane from '../panes/editor/EditorPane';

import WorkbenchClipboard from './WorkbenchClipboard';
import { WorkbenchPrefsDialog } from './WorkbenchPrefsDialog';
import WorkbenchToolbar from './WorkbenchToolbar';

import './Workbench.scss';
import WorkbenchMenubar from './WorkbenchMenubar';

const Workbench: React.FC = () => {
 
  // register keyboard shortcuts and get handlers
  const showHotkeysKeyCombo = 'Ctrl+Alt+K';
  const [cmState, cmDispatch] = useContext(CommandManagerContext);
  const hotkeys = useMemo(() => { return commandHotkeys(cmState.commands); }, [cmState.commands]);
  const { handleKeyDown, handleKeyUp } = useHotkeys(hotkeys, { showDialogKeyCombo: showHotkeysKeyCombo });

  // register show keyboard shortcuts command
  const [, hkDispatch] = useContext(HotkeysContext);
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      keyboardShortcutsCommand(() => hkDispatch({ type: "OPEN_DIALOG"}), showHotkeysKeyCombo)
    ]});
  }, []); 
   
  // render workbench
  return (
    <FluentProvider theme={webLightTheme}>
      <div className={'workbench'} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        <WorkbenchMenubar />
        <WorkbenchToolbar />
        <div className={'workspace'}>
          <EditorPane />
        </div>
        <WorkbenchClipboard />
        <WorkbenchPrefsDialog />
      </div>
    </FluentProvider>
  );
};

export default Workbench;
