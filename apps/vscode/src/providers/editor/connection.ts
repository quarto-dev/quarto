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
  VSC_VE_Init,
  VSC_VE_GetMarkdown, 
  VSC_VE_GetMarkdownFromState,
  VSC_VE_ApplyExternalEdit, 
  VSC_VEH_OnEditorUpdated,
  VSC_VEH_OnEditorReady, 
  VSCodeVisualEditor,
  VSCodeVisualEditorHost 
} from "editor-types";

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
  : { editor: VSCodeVisualEditor, dispose: VoidFunction } {

  const target = webviewPanelPostMessageTarget(webviewPanel);
  const { request, disconnect } = jsonRpcPostMessageRequestTransport(target);

  return {
    editor: {
      init: (markdown: string) => request(VSC_VE_Init, [markdown]),
      getMarkdown: () => request(VSC_VE_GetMarkdown, []),
      getMarkdownFromState: (state: unknown) => request(VSC_VE_GetMarkdownFromState, [state]),
      applyExternalEdit: (markdown: string) => request(VSC_VE_ApplyExternalEdit, [markdown])
    },
    dispose: disconnect
  };
}


// host interface provided to visual editor (vscode custom editor embedded in iframe)
export function visualEditorServer(
  context: ExtensionContext, 
  quartoContext: QuartoContext,
  webviewPanel: WebviewPanel,
  host: VSCodeVisualEditorHost
) : Disposable {
  
  const options = defaultEditorServerOptions(
    context.asAbsolutePath(path.join("assets", "editor", "resources")),
    quartoContext.pandocPath
  );
  
  const target = webviewPanelPostMessageTarget(webviewPanel);

  const stopServer = jsonRpcPostMessageServer(target, {
    ...editorServerMethods(options),
    ...editorHostMethods(host)
  });
  return {
    dispose: stopServer
  };
}



function editorHostMethods(host: VSCodeVisualEditorHost) : Record<string,JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [VSC_VEH_OnEditorReady]: () => host.onEditorReady(),
    [VSC_VEH_OnEditorUpdated]: args => host.onEditorUpdated(args[0]),
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