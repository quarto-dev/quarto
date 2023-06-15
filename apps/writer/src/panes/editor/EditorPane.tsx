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

import { Editor } from 'editor-ui';

import { EditorOperations } from 'editor';

import { editorDisplay } from './context/display';
import { editorUIContext } from './context/ui-context';

import { kWriterJsonRpcPath } from '../../constants';

import styles from './EditorPane.module.scss';

export interface EditorPaneProps {
  editorId: string;
  collab?: boolean;
}

export const EditorPane : React.FC<EditorPaneProps> = props => {

  // one time init of editor frame props
  const [request] = useState(() => jsonRpcBrowserRequestTransport(kWriterJsonRpcPath));
  const [uiContext] = useState(() => editorUIContext());
  
  // editor init handler
  const onEditorInit = async (editor: EditorOperations) => {
    const contentUrl = `content/${window.location.search.slice(1) || 'MANUAL.md'}`;
    const markdown = await (await fetch(contentUrl)).text();
    await editor.setMarkdown(props.collab ? "" : markdown, {}, false);
    await editor.focus();
  };

  return (
    <div className={'editor-pane'}>
      <Editor
        id={props.editorId}
        className={styles.editorParent}
        request={request}
        uiContext={uiContext}
        display={editorDisplay}
        onEditorInit={onEditorInit}
      />
    </div>
  );
}

