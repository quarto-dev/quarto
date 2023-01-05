/*
 * EditorContainer.tsx
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

import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';

import { HotkeysContext, useHotkeys } from "@blueprintjs/core";

import { JsonRpcRequestTransport } from 'core';

import { 
  commandHotkeys, 
  CommandManagerContext, 
  Commands, 
  Editor, 
  EditorFind, 
  keyboardShortcutsCommand, 
  showContextMenu
} from 'editor-ui';

import { EditorMenuItem, EditorOperations, EditorUIContext, XRef } from 'editor';

import { syncEditorToHost, VisualEditorHostClient } from './sync';
import EditorToolbar from './EditorToolbar';

import styles from './Editor.module.scss';

export interface EditorContainerProps {
  host: VisualEditorHostClient;
  request: JsonRpcRequestTransport;  
}

const EditorContainer: React.FC<EditorContainerProps> = (props) => {
  
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
 
  // one time creation of editorUIContext
  const [uiContext] = useState(() => editorUIContext(props.host));

  // pair editor w/ host on on init
  const onEditorInit = useCallback((editor: EditorOperations) => {
    syncEditorToHost(editor, props.host, uiContext.isActiveTab());
    return Promise.resolve();
  }, []);

  // ensure that keys we handle aren't propagated to vscode
  const keyboardEventHandler = (handler: React.KeyboardEventHandler) => {
    return (event: React.KeyboardEvent<HTMLElement>) => {
      handler(event);
      if (event.isDefaultPrevented()) {
        event.stopPropagation();
      }
    };
  }

  return (
    <div 
      className={styles.editorParent} 
      onKeyDown={keyboardEventHandler(handleKeyDown)} 
      onKeyUp={keyboardEventHandler(handleKeyUp)}
    >
      <EditorToolbar/>
      <Editor
        className={styles.editorFrame} 
        request={props.request}
        uiContext={uiContext}
        display={editorDisplay(props.host)}
        onEditorInit={onEditorInit}
      >
        <EditorFind />
      </Editor>
    </div>
  );
}

function editorDisplay(host: VisualEditorHostClient)  {
  return (commands: () => Commands) => {
    return {
      openURL(url: string) {
        host.openURL(url);
      },
      navigateToXRef(file: string, xref: XRef) {
        host.navigateToXRef(file, xref);
      },
      navigateToFile(file: string) {
        host.navigateToFile(file);
      },
      showContextMenu(
        items: EditorMenuItem[],
        clientX: number,
        clientY: number
      ): Promise<boolean> {
        return showContextMenu(commands(), items, clientX, clientY);
      }
    };
  };
}

function editorUIContext(host: VisualEditorHostClient): EditorUIContext {
  return {
    // check if we are the active tab
    isActiveTab(): boolean {
      return true;
    },

    // get the path to the current document
    getDocumentPath(): string | null {
      return null;
    },

    // ensure the edited document is saved on the server before proceeding
    // (note this just means that the server has a copy of it for e.g.
    // indexing xrefs, from the user's standpoint the doc is still dirty)
    async withSavedDocument(): Promise<boolean> {
      await host.flushEditorUpdates();
      return true;
    },

    // get the default directory for resources (e.g. where relative links point to)
    getDefaultResourceDir(): string {
      return "";
    },

    // map from a filesystem path to a resource reference
    mapPathToResource(path: string): string {
      return path;
    },

    // map from a resource reference (e.g. images/foo.png) to a URL we can use in the document
    mapResourceToURL(path: string): string {
      return path;
    },

    // watch a resource for changes (returns an unsubscribe function)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    watchResource(_path: string, _notify: VoidFunction): VoidFunction {
      return () => {
        /* */
      };
    },

    // translate a string
    translateText(text: string): string {
      return text;
    },

    // are there dropped uris available?
    droppedUris(): string[] | null {
      return null;
    },

    // uris from the clipboard
    async clipboardUris(): Promise<string[] | null> {
      return null;
    },

    // image from the clipboard (returned as file path)
    async clipboardImage(): Promise<string | null> {
      return null;
    },

    // resolve image uris (make relative, copy to doc local 'images' dir, etc)
    async resolveImageUris(uris: string[]): Promise<string[]> {
      return uris;
    },

    // are we running in windows desktop mode?
    isWindowsDesktop(): boolean {
      return false;
    },
  };
}

export default EditorContainer;
