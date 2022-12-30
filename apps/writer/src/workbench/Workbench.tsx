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

import React from 'react';

import { useEditorHotkeys } from 'editor-ui';

import EditorPane from '../panes/editor/EditorPane';

import WorkbenchNavbar from './WorkbenchNavbar';
import WorkbenchClipboard from './WorkbenchClipboard';
import { WorkbenchPrefsDialog } from './WorkbenchPrefsDialog';
import WorkbenchToolbar from './WorkbenchToolbar';

import './Workbench.scss';

const Workbench: React.FC = () => {
 
  const { handleKeyDown, handleKeyUp } = useEditorHotkeys();

  // render workbench
  return (
    <div className={'workbench'} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      <WorkbenchNavbar />
      <WorkbenchToolbar />
      <div className={'workspace'}>
        <EditorPane />
      </div>
      <WorkbenchClipboard />
      <WorkbenchPrefsDialog />
    </div>
  );
};

export default Workbench;
