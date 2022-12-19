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

import { WebviewApi } from "vscode-webview";


import { jsonRpcPostMessageRequestTransport, JsonRpcRequestTransport } from "core";
import { windowJsonRpcPostMessageTarget } from "core-browser";

import { editorJsonRpcServer, EditorServer } from "editor";

import { kVEHostApplyVisualEdit, VisualEditorContainer } from "vscode-types";

import { EditorState } from "./state";

export interface EditorHost {
  vscode: WebviewApi<EditorState>;
  server: EditorServer;
  container: VisualEditorContainer
}

export function editorHost(vscode: WebviewApi<EditorState>) : EditorHost {
  const target = windowJsonRpcPostMessageTarget(vscode, window);
  const { request } = jsonRpcPostMessageRequestTransport(target);
  return {
    vscode,
    server: editorJsonRpcServer(request),
    container: editorJsonRpcContainer(request)
  }
}

export function editorJsonRpcContainer(request: JsonRpcRequestTransport) : VisualEditorContainer {
  return {
    applyVisualEdit: (text: string) => request(kVEHostApplyVisualEdit, [text])
  };
}
