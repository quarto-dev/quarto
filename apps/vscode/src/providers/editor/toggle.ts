/*
 * toggle.ts
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

import { commands, window, workspace, TextDocument, ViewColumn } from "vscode";
import { Command } from "../../core/command";
import { isQuartoDoc, kQuartoLanguageId } from "../../core/doc";
import { VisualEditorProvider } from "./editor";




export function editInVisualModeCommand() : Command {
  return {
    id: "quarto.editInVisualMode",
    execute() {
      const editor = window.activeTextEditor;
      if (editor && isQuartoDoc(editor.document)) {
        reopenEditorInVisualMode(editor.document, editor.viewColumn);
      }
    }
  };
}

export function editInSourceModeCommand() : Command {
  return {
    id: "quarto.editInSourceMode",
    execute() {
      const activeVisual = VisualEditorProvider.activeEditor();
      if (activeVisual) {
        reopenEditorInSourceMode(activeVisual.document, '', activeVisual.viewColumn);
      } 
    }
  };
}

export async function reopenEditorInVisualMode(
  document: TextDocument,
  viewColumn?: ViewColumn
) {
 
  // save then close
  await commands.executeCommand("workbench.action.files.save");
  await commands.executeCommand('workbench.action.closeActiveEditor');

  // open in visual mode
  await commands.executeCommand("vscode.openWith", 
    document.uri, 
    VisualEditorProvider.viewType,
    {
      viewColumn
    }
  );
}

export async function reopenEditorInSourceMode(
  document: TextDocument, 
  untitledContent?: string, 
  viewColumn?: ViewColumn
) {
  if (!document.isUntitled) {
    await commands.executeCommand("workbench.action.files.save");
  }

  // note pending switch to source
  VisualEditorProvider.recordPendingSwitchToSource(document);

  // close editor (return immediately as if we don't then any 
  // rpc method that calls this will result in an error b/c the webview
  // has been torn down by the time we return)
  commands.executeCommand('workbench.action.closeActiveEditor').then(async () => {
    if (document.isUntitled) {
      const doc = await workspace.openTextDocument({
        language: kQuartoLanguageId,
        content: untitledContent || '',
      });
      await window.showTextDocument(doc, viewColumn, false);
    } else {
      const doc = await workspace.openTextDocument(document.uri);
      await window.showTextDocument(doc, viewColumn, false);
    }
  });
  
}
