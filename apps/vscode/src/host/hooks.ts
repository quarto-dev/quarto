/*
 * hooks.ts
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

import { Uri, WebviewPanelOptions, WebviewOptions, ViewColumn } from 'vscode';

import * as hooks from 'positron';

import { ExtensionHost, HostWebviewPanel } from '.';
import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument, pythonWithReticulate } from './executors';
import { TextDocument } from 'vscode';
import { MarkdownEngine } from '../markdown/engine';

declare global {
	function acquirePositronApi() : hooks.PositronApi;
}

let api : hooks.PositronApi | null | undefined;

export function hooksApi() : hooks.PositronApi | null {
  if (api === undefined) {
    try {
      api = acquirePositronApi();
    } catch {
      api = null;
    }
  }
  return api;
}

export function hasHooks() {
  return !!hooksApi();
}

export function hooksExtensionHost() : ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages)
    executableLanguages,

    cellExecutorForLanguage: async (language: string, document: TextDocument, engine: MarkdownEngine, silent?: boolean) 
      : Promise<CellExecutor | undefined> => {
      switch(language) {
        // use hooks for known runtimes
        case "python":
        case "r":
          return {
            execute: async (blocks: string[], _editorUri?: Uri) : Promise<void> => {
              for (const block of blocks) {
                let code = block;
                if (language === "python" && isKnitrDocument(document, engine)) {
                  language = "r";
                  code = pythonWithReticulate(block);
                }
                await hooksApi()?.runtime.executeCode(language, code, true);
              } 
            }
          };

        // delegate for other languages
        default:
          return cellExecutorForLanguage(language, document, engine, silent);
      }
    },

    createPreviewPanel: (
      viewType: string, 
      title: string,
      preserveFocus?: boolean, 
      options?: WebviewPanelOptions & WebviewOptions
    ): HostWebviewPanel => {

      // create preview panel
      const panel = hooksApi()?.window.createPreviewPanel(
        viewType,
        title,
        preserveFocus,
        {
          enableScripts: options?.enableScripts,
          enableForms: options?.enableForms,
          localResourceRoots: options?.localResourceRoots,
          portMapping: options?.portMapping
        }
      )!;
      
      // adapt to host interface
      return new HookWebviewPanel(panel);
    }
  };
}


class HookWebviewPanel implements HostWebviewPanel {
  constructor(private readonly panel_: hooks.PreviewPanel) {}

  get webview() { return this.panel_.webview; };
  get visible() { return this.panel_.visible; };
  reveal(_viewColumn?: ViewColumn, preserveFocus?: boolean) {
    this.panel_.reveal(preserveFocus);
  }
  onDidChangeViewState = this.panel_.onDidChangeViewState;
  onDidDispose = this.panel_.onDidDispose;
  dispose() { this.panel_.dispose(); };
}