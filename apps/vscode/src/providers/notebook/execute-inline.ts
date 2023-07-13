/*
 * execute-inline.ts
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


import * as vscode from "vscode"
import { NotebookCellStatusBarItem } from "vscode";
import { WorkspaceEdit } from "vscode";
import { ProviderResult } from "vscode";
import { CancellationToken } from "vscode";
import { NotebookCell } from "vscode";
import { getWholeRange } from "../../core/doc";

export function activateExecuteInline() {

  const notebookExecutions = new Map<string, Map<string,number>>();


  let counter = 1;
  // W0sZmlsZQ==
  vscode.notebooks.registerNotebookCellStatusBarItemProvider("jupyter-notebook",{
    async provideCellStatusBarItems(cell: NotebookCell, token: CancellationToken): Promise<NotebookCellStatusBarItem | NotebookCellStatusBarItem[]> {
      
      let newExecution = false;
      if (cell.executionSummary?.executionOrder !== undefined) {
       
        let cellExecutions = notebookExecutions.get(cell.notebook.uri.toString());
        if (cellExecutions === undefined) {
          newExecution = true;
          cellExecutions = new Map<string,number>();
          notebookExecutions.set(cell.notebook.uri.toString(), cellExecutions);
        }
        const cellExecutionOrder = cellExecutions.get(cell.document.uri.toString());
        if (cellExecutionOrder !== cell.executionSummary?.executionOrder) {
          newExecution = true;
          cellExecutions.set(cell.document.uri.toString(), cell.executionSummary.executionOrder);
        }
        if (newExecution) {
          console.log(`CELL ${cell.index} EXECUTED`);
        }
      }

      if (newExecution) {

        // re-execute all markdown cells with expressions (updating their metadata) then
        // edit their markdown directly

        /*
        setTimeout(async () => {
          for (let i=0; i<cell.notebook.cellCount; i++) {
            const c = cell.notebook.cellAt(i);
            if (c.kind === vscode.NotebookCellKind.Markup) {
             
              
              // c.metadata.custom.metadata.counter = counter++;
             
              const edit = new WorkspaceEdit();
              edit.replace(c.document.uri, getWholeRange(c.document), c.document.getText() + `${counter++}`);
              await vscode.workspace.applyEdit(edit);
            }
          }
        }, 100);
        */
        
       
      }
      

      return [];
    }
  } );

  const channel = vscode.notebooks.createRendererMessaging("quarto.markdown-it.qmd-extension");
  channel.onDidReceiveMessage(event => {


    //console.log("RENDERING MARKDOWN CELL " + String(event.message));
  });


}