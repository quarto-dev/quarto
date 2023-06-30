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

import { Uri, DocumentSelector, Disposable } from "vscode";

import * as hooks from 'positron';

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
  executableLanguages(visualMode: boolean) : string[];
  cellExecutorForLanguage(
    language: string, 
    silent?: boolean
  ) : Promise<CellExecutor | undefined>;

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

export async function extensionHost() : Promise<ExtensionHost> {
  if (await hasHooks()) {
    return {
      executableLanguages: (_visualMode: boolean) => executableLanguages(),
      cellExecutorForLanguage: async (language: string, silent?: boolean) 
        : Promise<CellExecutor | undefined> => {
        switch(language) {
          case "python":
          case "r":
            return {
              execute: async (blocks: string[], _editorUri?: Uri) : Promise<void> => {
                for (const block of blocks) {
                  await hooks.runtime.executeCode(language, block, true);
                } 
              }
            };
          default:
            return cellExecutorForLanguage(language, silent);
        }
      },
      createPreviewPanel
    };
  } else {
    return {
      executableLanguages: (visualMode: boolean) => {
         // python doesn't work in visual mode b/c jupyter.execSelectionInteractive 
         // wants a text editor to be active
         return executableLanguages().filter(language => !visualMode || (language !== "python"))
      },
      cellExecutorForLanguage,
      createPreviewPanel,
    };
  }
}


async function hasHooks() {
  try {
    hooks.version.toLowerCase();
    return true;
  } catch {
    return false;
  }
}
