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

import * as path from "path";

import { Disposable, ExtensionContext, WebviewPanel } from "vscode";

import { 
  kVEInit,
  kVEGetMarkdown, 
  kVEApplyTextEdit, 
  kVEHostApplyVisualEdit, 
  kVEHostEditorReady, 
  VisualEditor,
  VisualEditorHost 
} from "vscode-types";

import { 
  jsonRpcPostMessageServer, 
  JsonRpcPostMessageTarget, 
  JsonRpcServerMethod,
  jsonRpcPostMessageRequestTransport
} from "core";

import { defaultEditorServerOptions, editorServerMethods } from "editor-server";

import { QuartoContext } from "quarto-core";

// interface to visual editor (vscode custom editor embedded in iframe)
export function visualEditorClient(webviewPanel: WebviewPanel) 
  : { editor: VisualEditor, dispose: VoidFunction } {

  const target = webviewPanelPostMessageTarget(webviewPanel);
  const { request, disconnect } = jsonRpcPostMessageRequestTransport(target);

  return {
    editor: {
      init: (markdown: string) => request(kVEInit, [markdown]),
      getMarkdown: () => request(kVEGetMarkdown, []),
      applyTextEdit: (markdown: string) => request(kVEApplyTextEdit, [markdown])
    },
    dispose: disconnect
  };
}


// host interface provided to visual editor (vscode custom editor embedded in iframe)
export function visualEditorServer(
  context: ExtensionContext, 
  quartoContext: QuartoContext,
  webviewPanel: WebviewPanel,
  host: VisualEditorHost
) : Disposable {
  
  const options = defaultEditorServerOptions(
    context.asAbsolutePath(path.join("assets", "editor", "resources")),
    quartoContext.pandocPath
  );
  
  const target = webviewPanelPostMessageTarget(webviewPanel);

  const stopServer = jsonRpcPostMessageServer(target, {
    ...editorServerMethods(options),
    ...editorContainerMethods(host)
  });
  return {
    dispose: stopServer
  };
}



function editorContainerMethods(host: VisualEditorHost) : Record<string,JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kVEHostEditorReady]: () => host.editorReady(),
    [kVEHostApplyVisualEdit]: args => host.applyVisualEdit(args[0])
  };
  return methods;
}



function webviewPanelPostMessageTarget(webviewPanel: WebviewPanel) : JsonRpcPostMessageTarget {
  return {
    postMessage: (data) => {
      webviewPanel.webview.postMessage(data);
    },
    onMessage: (handler: (data: unknown) => void) => {
      const disposable = webviewPanel.webview.onDidReceiveMessage(ev => {
        handler(ev);
      });
      return () => {
        disposable.dispose();
      };
    }
  };
}