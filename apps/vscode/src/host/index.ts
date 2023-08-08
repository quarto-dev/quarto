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

import vscode, { DocumentSelector, Disposable, WebviewPanelOptions, WebviewOptions } from "vscode";


import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument } from "./executors";
import { EditorToolbarProvider } from "./toolbar";
import { createPreviewPanel } from "./preview";
import { hasHooks, hooksExtensionHost } from "./hooks";
import { TextDocument } from "vscode";
import { MarkdownEngine } from "../markdown/engine";

export type { CellExecutor };
export type { EditorToolbarProvider,  ToolbarItem, ToolbarCommand, ToolbarButton, ToolbarMenu } from './toolbar';

export interface HostWebviewPanel extends vscode.Disposable {
  readonly webview: vscode.Webview;
  readonly visible: boolean;
  reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void;
  readonly onDidChangeViewState: vscode.Event<any>;
  readonly onDidDispose: vscode.Event<void>;
}

export interface ExtensionHost {

  // code execution
  executableLanguages(visualMode: boolean, document: TextDocument, engine: MarkdownEngine) : string[];
  cellExecutorForLanguage(
    language: string, 
    document: TextDocument,
    engine: MarkdownEngine,
    silent?: boolean
  ) : Promise<CellExecutor | undefined>;

  // preview
  createPreviewPanel(
    viewType: string, 
    title: string,
    preserveFocus?: boolean, 
    options?: WebviewPanelOptions & WebviewOptions
  ): HostWebviewPanel;

  // editor toolbar
  registerEditorToolbarProvider?(
    selector: DocumentSelector, 
    provider: EditorToolbarProvider
  ): Disposable;

}

export function extensionHost() : ExtensionHost {
  if (hasHooks()) {
    return hooksExtensionHost();
  } else {
    return defaultExtensionHost();
  }
}

function defaultExtensionHost() : ExtensionHost {
  return {
    executableLanguages: (visualMode: boolean, document: TextDocument, engine: MarkdownEngine) => {
      
       const languages = executableLanguages();
       const knitr = isKnitrDocument(document, engine);

       // jupyter python (as distinct from knitr python) doesn't work in visual mode b/c
       // jupyter.execSelectionInteractive  wants a text editor to be active
       return languages.filter(language => knitr || !visualMode || (language !== "python"));
    },
    cellExecutorForLanguage,
    createPreviewPanel,
  };
}