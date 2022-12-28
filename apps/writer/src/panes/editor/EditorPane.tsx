/*
 * EditorPane.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
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

import React, { useState } from 'react';

import { jsonRpcBrowserRequestTransport } from 'core-browser';

import { EditorFrame, Pane } from 'editor-ui';

import { kWriterJsonRpcPath } from '../../store';

import { editorDisplay } from './context/display';
import { editorUIContext } from './context/ui-context';

import EditorOutlineSidebar from './outline/EditorOutlineSidebar';
import EditorFind from './EditorFind';

import styles from './EditorPane.module.scss';

const EditorPane : React.FC = () => {

  // one time init of editor frame props
  const [request] = useState(() => jsonRpcBrowserRequestTransport(kWriterJsonRpcPath));
  const [uiContext] = useState(() => editorUIContext());
  
  return (
    <Pane className={'editor-pane'}>
      <EditorFrame
        className={styles.editorParent} 
        request={request}
        uiContext={uiContext}
        display={editorDisplay}
      >
        <EditorOutlineSidebar />
        <EditorFind />
      </EditorFrame>
    </Pane>
  );
}

export default EditorPane;
