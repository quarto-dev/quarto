/*
 * server.ts
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

import { Disposable, ExtensionContext, TextDocument, WebviewPanel, workspace, WorkspaceEdit } from "vscode";
import { defaultEditorServerOptions, editorServerMethods } from "editor-server";
import { kVEHostApplyVisualEdit, kVEHostEditorReady, VisualEditorContainer } from "vscode-types";
import { QuartoContext } from "quarto-core";
import { jsonRpcPostMessageServer, JsonRpcPostMessageTarget, JsonRpcServerMethod } from "core";

import { getWholeRange } from "../../core/doc";
import { webviewPanelPostMessageTarget } from "./jsonrpc";

// setup postMessage server on webview panel
export function editorServer(
  context: ExtensionContext, 
  quartoContext: QuartoContext,
  webviewPanel: WebviewPanel,
  container: VisualEditorContainer
) : Disposable {
  
  const options = defaultEditorServerOptions(
    context.asAbsolutePath(path.join("assets", "editor", "resources")),
    quartoContext.pandocPath
  );
  
  const target = webviewPanelPostMessageTarget(webviewPanel);

  const stopServer = jsonRpcPostMessageServer(target, {
    ...editorServerMethods(options),
    ...editorContainerMethods(container)
  });
  return {
    dispose: stopServer
  };
}



function editorContainerMethods(container: VisualEditorContainer) : Record<string,JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kVEHostEditorReady]: () => container.editorReady(),
    [kVEHostApplyVisualEdit]: args => container.applyVisualEdit(args[0])
  };
  return methods;
}

