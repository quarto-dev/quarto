/*
 * main.ts
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
import * as path from "path";
import { MarkdownEngine } from "./markdown/engine";
import { kQuartoDocSelector } from "./core/doc";
import { activateLsp, deactivate as deactivateLsp } from "./lsp/client";
import { cellCommands } from "./providers/cell/commands";
import { quartoCellExecuteCodeLensProvider } from "./providers/cell/codelens";
import { activateQuartoAssistPanel } from "./providers/assist/panel";
import { activateCommon } from "./extension";
import { activatePreview } from "./providers/preview/preview";
import { activateRender } from "./providers/render";
import { initQuartoContext, quartoContextUnavailable } from "quarto-core";
import { activateStatusBar } from "./providers/statusbar";
import { walkthroughCommands } from "./providers/walkthrough";
import { activateLuaTypes } from "./providers/lua-types";
import { activateCreate } from "./providers/create/create";
import { activateEditor, VisualEditorProvider } from "./providers/editor/editor";
import { activateCopyFiles } from "./providers/copyfiles";
import { activateZotero } from "./providers/zotero/zotero";;
import { extensionHost } from "./host";
import { configuredQuartoPath } from "./core/quarto";
import { activateDenoConfig } from "./providers/deno-config";
import { determineMode, setEditorOpener } from "./providers/editor/toggle";

let suppressOpenHandler = false;

export async function activate(context: vscode.ExtensionContext) {

  // create extension host
  const host = extensionHost();

  // create markdown engine
  const engine = new MarkdownEngine();

  // commands
  const commands = cellCommands(host, engine);

  // get quarto context (some features conditional on it)
  const quartoPath = await configuredQuartoPath();
  const workspaceFolder = vscode.workspace.workspaceFolders?.length
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;
  const quartoContext = initQuartoContext(
    quartoPath,
    workspaceFolder,
    // Look for quarto in the app root; this is where Positron installs it
    [path.join(vscode.env.appRoot, 'quarto', 'bin')],
    vscode.window.showWarningMessage
  );
  if (quartoContext.available) {

    // enable commands conditional on quarto installation
    vscode.commands.executeCommand(
      "setContext",
      "quartoAvailable",
      true
    );

    // ensure quarto is on the path
    context.environmentVariableCollection.prepend(
      "PATH",
      path.delimiter + quartoContext.binPath + path.delimiter
    );

    // status bar
    activateStatusBar(quartoContext);

    // lua types
    await activateLuaTypes(context, quartoContext);

    // deno config
    activateDenoConfig(context, engine);

    // lsp
    const lspClient = await activateLsp(context, quartoContext, engine);

    // provide visual editor
    const editorCommands = activateEditor(context, host, quartoContext, lspClient, engine);
    commands.push(...editorCommands);

    // zotero 
    const zoteroCommands = await activateZotero(context, lspClient);
    commands.push(...zoteroCommands);

    // assist panel
    const assistCommands = activateQuartoAssistPanel(context, engine);
    commands.push(...assistCommands);
  }

  // walkthough
  commands.push(...walkthroughCommands(host, quartoContext));

  // provide render
  const renderCommands = activateRender(quartoContext, engine);
  commands.push(...renderCommands);

  // provide preview
  const previewCommands = activatePreview(context, host, quartoContext, engine);
  commands.push(...previewCommands);

  // provide create
  const createCommands = await activateCreate(context, quartoContext);
  commands.push(...createCommands);

  // provide code lens
  vscode.languages.registerCodeLensProvider(
    kQuartoDocSelector,
    quartoCellExecuteCodeLensProvider(host, engine)
  );

  // provide file copy/drop handling
  activateCopyFiles(context);

  // activate providers common to browser/node
  activateCommon(context, host, engine, commands);

  // if positron
  setEditorOpener();

  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('quarto.defaultEditor')) {
      setEditorOpener();
    }
  });

  const documentOpenHandler = vscode.workspace.onDidOpenTextDocument(async (document: vscode.TextDocument) => {
    // Check if the document language is "quarto"
    const config = vscode.workspace.getConfiguration('quarto').get<string>('defaultEditor');
    if (document.languageId != 'quarto') {
      return;
    }
    if (suppressOpenHandler) {
      suppressOpenHandler = false; // Reset the flag
      return;
    }
    const editorMode = await determineMode(document.getText());
    if (editorMode && editorMode != config) {
      suppressOpenHandler = true;
      const editorOpener = editorMode === 'visual' ? VisualEditorProvider.viewType : 'textEditor';
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await vscode.commands.executeCommand("vscode.openWith",
        document.uri,
        editorOpener
      );
      return;
    }
  });

  // Add the event handler to the context subscriptions
  context.subscriptions.push(documentOpenHandler);

  // end if positron
}

export async function deactivate() {
  return deactivateLsp();
}

