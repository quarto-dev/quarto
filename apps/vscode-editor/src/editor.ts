/*
 * editor.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { jsonRpcPostMessageServer, JsonRpcPostMessageTarget } from "core";
import { Editor, EditorFormat, EditorHooks, kQuartoDocType, UpdateEvent } from "editor";
import throttle from "lodash.throttle";
import { kVEApplyTextEdit, kVEInit, VisualEditor } from "vscode-types";
import { WebviewApi } from "vscode-webview";

import { editorContext } from "./context";
import { editorHost } from "./host";
import { EditorState } from "./state";



export function createEditor(parent: HTMLElement, vscode: WebviewApi<EditorState>) {

  // connection to host + context
  const host = editorHost(vscode);

  // editable hook (update after we get initial payload)
  let loaded = false;
  const hooks: EditorHooks = {
    isEditable: () => loaded 
  }


  // create context
  const context = editorContext(host, hooks);

  Editor.create(parent, context, quartoEditorFormat()).then(async (editor) => {
    
    // throttle updates both ways
    const kThrottleDelayMs = 1000;

    // sync to text editor
    const applyEdit = throttle(() => {
      editor.getMarkdown(quartoWriterOptions())
        .then(code => {
          host.container.applyVisualEdit(code.code)
        });
    }, kThrottleDelayMs, { leading: false, trailing: true});

    // sync from text editor
    const receiveEdit = throttle((markdown) => {
      editor.setMarkdown(markdown, quartoWriterOptions(), false)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .then(_result => {
            //
        });
    }, kThrottleDelayMs, { leading: false, trailing: true});

    // setup communication channel for host
    editorContainerServer(vscode, {
      async init(markdown: string) {
      
        // put editor in writeable mode
        loaded = true;

        // init editor contents and sync cannonical version back to text editor
        const result = await editor.setMarkdown(markdown, quartoWriterOptions(), false);
        await host.container.applyVisualEdit(result.canonical);
        
        // visual editor => text editor (throttled)
        editor.subscribe(UpdateEvent, applyEdit);
  
      },
      
      async applyTextEdit(markdown: string) {
        // only apply external edits if we don't have focus
        if (!editor.hasFocus()) {
          receiveEdit(markdown);
        } 
      }
    })

    // let the host know we are ready
    await host.container.editorReady();    

  });

}


function editorContainerServer(vscode: WebviewApi<EditorState>, editor: VisualEditor) {

  // target for message bus
  const target: JsonRpcPostMessageTarget = {
    postMessage: (data) => {
      vscode.postMessage(data);
    },
    onMessage: (handler: (data: unknown) => void) => {
      const messageListener = (event: MessageEvent) => {
        const message = event.data; // The json data that the extension sent
        handler(message);
      };
      window.addEventListener('message', messageListener);
      return () => {
        window.removeEventListener('message', messageListener);
      }
    }
  };

  // create a server
  return jsonRpcPostMessageServer(target, {
    [kVEInit]: args => editor.init(args[0]),
    [kVEApplyTextEdit]: args => editor.applyTextEdit(args[0])
  })

}


function quartoWriterOptions() {
  return { 
    atxHeaders: true 
  };
}

function quartoEditorFormat() : EditorFormat {
  return  {
    pandocMode: 'markdown',
    pandocExtensions: '',
    rmdExtensions: {
      codeChunks: true,
      bookdownPart: true,
      bookdownXRef: true
    },
    hugoExtensions: {
      shortcodes: true
    },
    docTypes: [kQuartoDocType]
  }
}