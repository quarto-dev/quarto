/*
 * index.ts
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

import 'vscode-webview';

import { createEditor } from './editor/editor';

import { visualEditorHostClient } from './connection';

import "editor-ui/src/styles";

// editor div
const editorDiv = window.document.createElement("div");
editorDiv.style.position = 'absolute';
editorDiv.style.top = '0';
editorDiv.style.left = '0';
editorDiv.style.right = '0';
editorDiv.style.bottom = '0';
window.document.body.appendChild(editorDiv);

// create host and editor
const host = visualEditorHostClient( acquireVsCodeApi<unknown>());
createEditor(editorDiv, host);










