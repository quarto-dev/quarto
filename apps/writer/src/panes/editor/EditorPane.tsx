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

import React, { useContext, useEffect, useRef, useState } from 'react';

import { PlugConnectedRegular, PlugDisconnectedRegular } from "@fluentui/react-icons";

import { jsonRpcBrowserRequestTransport } from 'core-browser';

import { CommandManagerContext, Editor, EditorUICommandId, t } from 'editor-ui';

import { EditorOperations, ExtensionFn } from 'editor';

import { CollabConnection, collabExtension } from 'editor-collab';

import { editorDisplay } from './context/display';
import { editorUIContext } from './context/ui-context';

import { kWriterJsonRpcPath } from '../../constants';

import styles from './EditorPane.module.scss';
import { WorkbenchCommandId } from '../../workbench/commands';


export interface EditorPaneProps {
  editorId: string;
  collab?: boolean;
}

export const EditorPane : React.FC<EditorPaneProps> = props => {

  // manage connection command
  const [connected, setConnected] = useState(false);
  const [, cmDispatch] = useContext(CommandManagerContext);
  const collabListners = useRef(new Array<(connected: boolean) => void>());
  const collabConnection = useRef<CollabConnection>({
    onChanged(fn) {
      collabListners.current.push(fn);
    },
  });
  if (props.collab) {
    useEffect(() => {
      cmDispatch({ type: "ADD_COMMANDS", payload: [
        {
          id: WorkbenchCommandId.Connect,
          menuText: connected ? "Disconnect" : "Connect",
          icon: connected ? <PlugDisconnectedRegular/> : <PlugConnectedRegular />,
          group: t('commands:group_utilities'),
          keymap: [],
          isEnabled: () => true,
          isActive: () => connected,
          execute: () => {
            const isConnected = !connected;
            setConnected(isConnected);
            collabListners.current.forEach(listener => listener(isConnected));
            cmDispatch({ type: "EXEC_COMMAND", payload: EditorUICommandId.ActivateEditor });
          },
        },
      ]})
    }, [connected]);
  }

  // one time init of editor frame props
  const [request] = useState(() => jsonRpcBrowserRequestTransport(kWriterJsonRpcPath));
  const [uiContext] = useState(() => editorUIContext());
  const [extensions] = useState<Array<ExtensionFn>>(() => props.collab 
    ? [collabExtension(collabConnection.current)] 
    : []
  )

  // editor init handler
  const onEditorInit = async (editor: EditorOperations) => {
    if (!props.collab) {
      const contentUrl = `content/${window.location.search.slice(1) || 'MANUAL.md'}`;
      const markdown = await (await fetch(contentUrl)).text();
      await editor.setMarkdown(markdown, {}, false);
    }
    editor.focus();
  };

  return (
    <div className={'editor-pane'}>
      <Editor
        id={props.editorId}
        className={styles.editorParent}
        request={request}
        uiContext={uiContext}
        display={editorDisplay}
        extensions={extensions}
        onEditorInit={onEditorInit}
      />
    </div>
  );
}

