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

import React, { useEffect } from 'react';

import { Store } from 'redux';
import { Provider as StoreProvider } from 'react-redux';

import { FocusStyleManager } from '@blueprintjs/core';

import { WorkbenchState } from '../store/store';

import './Workbench.scss';
import { CommandManagerProvider } from '../commands/CommandManager';
import WorkbenchNavbar from './WorkbenchNavbar';
import WorkbenchClipboard from './WorkbenchClipboard';
import WorkbenchHotkeys from './WorkbenchHotkeys';
import EditorPane from '../panes/editor/EditorPane';
import MarkdownPane from '../panes/markdown/MarkdownPane';

interface WorkbenchProps {
  store: Store<WorkbenchState>;
}

const Workbench: React.FC<WorkbenchProps> = props => {
  // only show focus on key navigation
  useEffect(() => {
    FocusStyleManager.onlyShowFocusOnTabs();
  }, []);

  return (
    <div className={'workbench'}>
      <StoreProvider store={props.store}>
        <CommandManagerProvider>
          <WorkbenchNavbar />
          <div className={'workspace'}>
            <EditorPane />
            <MarkdownPane />
          </div>
          <WorkbenchClipboard />
          <WorkbenchHotkeys />
        </CommandManagerProvider>
      </StoreProvider>
    </div>
  );
};

export default Workbench;
