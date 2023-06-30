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
import { CellExecutor, cellExecutorForLanguage, executableLanguages } from './executors';

export function hasHooks() {
  try {
    hooks.version.toLowerCase();
    return true;
  } catch {
    return false;
  }
}

export function hooksExtensionHost() : ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages)
    executableLanguages,

    cellExecutorForLanguage: async (language: string, silent?: boolean) 
      : Promise<CellExecutor | undefined> => {
      switch(language) {
        // use hooks for known runtimes
        case "python":
        case "r":
          return {
            execute: async (blocks: string[], _editorUri?: Uri) : Promise<void> => {
              for (const block of blocks) {
                await hooks.runtime.executeCode(language, block, true);
              } 
            }
          };

        // delegate for other languages
        default:
          return cellExecutorForLanguage(language, silent);
      }
    },

    createPreviewPanel: (
      viewType: string, 
      title: string,
      preserveFocus?: boolean, 
      options?: WebviewPanelOptions & WebviewOptions
    ): HostWebviewPanel => {

      // create preview panel
      const panel = hooks.window.createPreviewPanel(
        viewType,
        title,
        preserveFocus,
        {
          enableScripts: options?.enableScripts,
          enableForms: options?.enableForms,
          localResourceRoots: options?.localResourceRoots,
          portMapping: options?.portMapping
        }
      );
      
      // adapt to host interface
      return {
        ...panel,
        reveal: (_viewColumn?: ViewColumn, preserveFocus?: boolean) => {
          panel.reveal(preserveFocus);
        }
      }
    }
  };
}