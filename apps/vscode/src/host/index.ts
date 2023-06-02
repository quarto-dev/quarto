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

import { DocumentSelector, Disposable } from "vscode";

import { CellExecutor, cellExecutorForLanguage, executableLanguages } from "./executors";
import { EditorToolbarProvider } from "./toolbar";
import { WebviewPanelOptions } from "vscode";
import { WebviewOptions } from "vscode";
import { WebviewPanel } from "vscode";
import { createPreviewPanel } from "./preview";

export type { CellExecutor };
export type { EditorToolbarProvider,  ToolbarItem, ToolbarCommand, ToolbarButton, ToolbarMenu } from './toolbar';

export interface ExtensionHost {

  // code execution
  executableLanguages() : string[];
  cellExecutorForLanguage(language: string, silent?: boolean) : Promise<CellExecutor | undefined>;

  // preview
  createPreviewPanel(
    viewType: string, 
    title: string,
    preserveFocus?: boolean, 
    options?: WebviewPanelOptions & WebviewOptions
  ): WebviewPanel;

  // editor toolbar
  registerEditorToolbarProvider?(
    selector: DocumentSelector, 
    provider: EditorToolbarProvider
  ): Disposable;

}

export function extensionHost() {
  return {
    executableLanguages,
    cellExecutorForLanguage,
    createPreviewPanel,
  };
}