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
import * as vscode from "vscode";
import { commands, window, workspace, TextDocument, ViewColumn } from "vscode";
import * as path from 'path';
import * as quarto from "quarto-core";
import fs from "node:fs";
import yaml from "js-yaml";
import { Command } from "../../core/command";
import { isQuartoDoc, kQuartoLanguageId } from "../../core/doc";
import { VisualEditorProvider } from "./editor";


export async function determineMode(doc: string): Promise<string | undefined> {
  let editorOpener = undefined;

  // check if file itself has a mode
  if (hasEditorMode(doc, "source")) {
    editorOpener = "source";
  }
  else if (hasEditorMode(doc, "visual")) {
    editorOpener = "visual";
  }
  // check if has a _quarto.yml or _quarto.yaml file with editor specified
  else {
    editorOpener = workspaceHasQuartoYaml();
  }

  return editorOpener;
}

export async function setEditorOpener() {
  const config = vscode.workspace.getConfiguration('quarto').get<string>('defaultEditor');
  const viewType = config === 'visual' ? VisualEditorProvider.viewType : 'textEditor';
  vscode.workspace.getConfiguration('workbench').update('editor.defaultView', viewType, true);
  await vscode.commands.executeCommand("workbench.action.setDefaultEditor",
    vscode.Uri.file('filename.qmd'),
    viewType
  );
}

export function workspaceHasQuartoYaml() {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (workspaceFolders && workspaceFolders.length > 0) {
    const rootPath = workspaceFolders[0].uri.fsPath;  // Only look in the root directory of the first workspace folder

    const quartoFilePathYml = path.join(rootPath, '_quarto.yml');
    const quartoFilePathYaml = path.join(rootPath, '_quarto.yaml');

    let fileContent: string | null = null;

    if (fs.existsSync(quartoFilePathYml)) {
      fileContent = fs.readFileSync(quartoFilePathYml, 'utf8');
    } else if (fs.existsSync(quartoFilePathYaml)) {
      fileContent = fs.readFileSync(quartoFilePathYaml, 'utf8');
    }

    if (fileContent) {
      const parsedYaml = yaml.load(fileContent) as any;
      if (parsedYaml.editor === 'visual' || parsedYaml.editor === 'source') {
        return parsedYaml.editor;
      }
    }
  }

  return undefined;
}

export function hasEditorMode(doc: string, mode: string) {
  if (doc) {
    const match = doc.match(quarto.kRegExYAML);
    if (match) {
      const yaml = match[0];
      return (
        !!yaml.match(new RegExp("^editor:\\s+" + mode + "\\s*$", "gm")) ||
        !!yaml.match(new RegExp("^[ \\t]*" + mode + ":\\s*(default)?\\s*$", "gm"))
      );
    }
  }
  return false;
}

export function editInVisualModeCommand(): Command {
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

export function editInSourceModeCommand(): Command {
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
  // rpc method that calls this wil result in an error b/c the webview
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
