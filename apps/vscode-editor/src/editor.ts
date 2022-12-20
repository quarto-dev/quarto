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
import { BlurEvent, Editor, EditorFormat, EditorHooks, kQuartoDocType, UpdateEvent } from "editor";
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
    
     // sync to text editor
     const applyEdit = async () => {
      const code = await editor.getMarkdown(quartoWriterOptions());
      await host.container.applyVisualEdit(code.code);
    };

    // sync from text editor
    const receiveEdit = async (markdown: string) : Promise<void> => {
      editor.setMarkdown(markdown, quartoWriterOptions(), false);
    };


    // setup communication channel for host
    editorContainerServer(vscode, {
      async init(markdown: string) {
      
        // put editor in writeable mode
        loaded = true;

        // init editor contents and sync cannonical version back to text editor
        const result = await editor.setMarkdown(markdown, quartoWriterOptions(), false);
        await host.container.applyVisualEdit(result.canonical);
        
        // propagate changes on update (throttled)
        editor.subscribe(UpdateEvent, asyncThrottle(applyEdit, 1000));
  
        // immediately propagate changes on blur
        editor.subscribe(BlurEvent, () => applyEdit);


      },
      applyTextEdit: asyncThrottle(receiveEdit, 1000)
    })

    // let the host know we are ready
    await host.container.editorReady();    

  });

}

/**
 * Throttles an async function in a way that can be awaited.
 * By default throttle doesn't return a promise for async functions unless it's invoking them immediately. See CUR-4769 for details.
 * @param func async function to throttle calls for.
 * @param wait same function as lodash.throttle's wait parameter.
 *             Call this function at most this often.
 * @returns a promise which will be resolved/ rejected only if the function is executed, with the result of the underlying call.
 */
function asyncThrottle<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F extends (...args: any[]) => Promise<any>
>(func: F, wait?: number) {
  const throttled = throttle((resolve, reject, args: Parameters<F>) => {
    func(...args).then(resolve).catch(reject);
  }, wait);
  return (...args: Parameters<F>): ReturnType<F> =>
    new Promise((resolve, reject) => {
      throttled(resolve, reject, args);
    }) as ReturnType<F>;
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