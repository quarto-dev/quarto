/*
 * connection.ts
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


import { WebviewApi } from "vscode-webview";

import { 
  jsonRpcPostMessageRequestTransport, 
  jsonRpcPostMessageServer, 
  JsonRpcPostMessageTarget, 
  JsonRpcRequestTransport 
} from "core";

import { windowJsonRpcPostMessageTarget } from "core-browser";

import { 
  kVEApplyTextEdit, 
  kVEGetMarkdown, 
  kVEGetMarkdownFromState,
  kVEHostEditorUpdated,
  kVEHostEditorReady, 
  kVEInit, 
  VisualEditor, 
  VisualEditorHost 
} from "vscode-types";

import { editorJsonRpcServer, EditorServer } from "editor";

export interface VisualEditorHostClient extends VisualEditorHost {
  vscode: WebviewApi<unknown>;
  server: EditorServer;
}

// interface to visual editor host (vs code extension)
export function visualEditorHostClient(vscode: WebviewApi<unknown>) : VisualEditorHostClient {
  const target = windowJsonRpcPostMessageTarget(vscode, window);
  const { request } = jsonRpcPostMessageRequestTransport(target);
  return {
    vscode,
    server: editorJsonRpcServer(request),
    ...editorJsonRpcContainer(request)
  }
}

// interface provided to visual editor host (vs code extension)
export function visualEditorHostServer(vscode: WebviewApi<unknown>, editor: VisualEditor) {

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
    [kVEGetMarkdown]: () => editor.getMarkdown(),
    [kVEGetMarkdownFromState]: args => editor.getMarkdownFromState(args[0]),
    [kVEApplyTextEdit]: args => editor.applyTextEdit(args[0])
  })

}




function editorJsonRpcContainer(request: JsonRpcRequestTransport) : VisualEditorHost {
  return {
    editorReady: () => request(kVEHostEditorReady, []),
    editorUpdated: (state: unknown, flush: boolean) => request(kVEHostEditorUpdated, [state, flush]),
  };
}
