/*
 * client.ts
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

import { jsonRpcPostMessageRequestTransport } from "core";
import { WebviewPanel } from "vscode";
import { kVEApplyTextEdit, kVEInit, VisualEditor } from "vscode-types";
import { webviewPanelPostMessageTarget } from "./jsonrpc";


export function visualEditorClient(webviewPanel: WebviewPanel) : { editor: VisualEditor, dispose: VoidFunction } {

  const target = webviewPanelPostMessageTarget(webviewPanel);
  const { request, disconnect } = jsonRpcPostMessageRequestTransport(target);

  return {
    editor: {
      init: (markdown: string) => request(kVEInit, [markdown]),
      applyTextEdit: (markdown: string) => request(kVEApplyTextEdit, [markdown])
    },
    dispose: disconnect
  };


}