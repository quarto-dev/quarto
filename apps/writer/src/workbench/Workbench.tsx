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

import React, { useContext, useMemo } from 'react';


import { FluentProvider } from '@fluentui/react-components';

import { useHotkeys } from "ui-widgets";

import { commandHotkeys, CommandManagerContext, fluentTheme } from 'editor-ui';

import { EditorPane } from '../panes/editor/EditorPane';

import WorkbenchClipboard from './WorkbenchClipboard';
import { WorkbenchPrefsDialog } from './WorkbenchPrefsDialog';
import WorkbenchMenubar from './WorkbenchMenubar';
import WorkbenchToolbar from './WorkbenchToolbar';

import './Workbench.scss';

export interface WorkbenchProps {
  editorId: string;
}

export const Workbench: React.FC<WorkbenchProps> = props => {
 
  // register keyboard shortcuts and get handlers
  const [cmState] = useContext(CommandManagerContext);
  const hotkeys = useMemo(() => { return commandHotkeys(cmState.commands); }, [cmState.commands]);
  const { handleKeyDown, handleKeyUp } = useHotkeys(hotkeys, {});
 
  // render workbench
  return (
    <FluentProvider theme={fluentTheme()}>
      <div className={'workbench'} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        <WorkbenchMenubar />
        <WorkbenchToolbar />
        <div className={'workspace'}>
          <EditorPane {...props} />
        </div>
        <WorkbenchClipboard />
        <WorkbenchPrefsDialog />
      </div>
    </FluentProvider>
  );
};

