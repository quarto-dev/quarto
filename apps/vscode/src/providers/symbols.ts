/*
 * symbols.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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
import { Command } from "../core/command";

class ToggleCodeCellsInOutlineCommand implements Command {
  public readonly id = "quarto.toggleCodeCellsInOutline";

  public async execute() {
    const config = vscode.workspace.getConfiguration("quarto");
    const currentValue = config.get<boolean>("symbols.showCodeCellsInOutline", true);
    const newValue = !currentValue;

    // The LSP re-registers its document symbol provider on config change, which triggers VS Code to re-query the outline.
    // The VS Code extension restores outline expansion state after the re-query (see `registerOutlineConfigListener`).
    await config.update("symbols.showCodeCellsInOutline", newValue, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      `Code cells in outline will now be ${newValue ? "shown" : "hidden"}.`
    );
  }
}

export function symbolsCommands(): Command[] {
  return [new ToggleCodeCellsInOutlineCommand()];
}



const expandOutline = async (uri: vscode.Uri) => {
  // make sure document can provide symbols (for the outline) before expanding the outline
  await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri);
  await vscode.commands.executeCommand("outline.expand");
};
/**
 * Executes `listener(editor)` ONCE, the next time the user switches their active text editor to a qmd.
 */
const onNextChangeActiveTextEditorToQmd = (listener: (editor: vscode.TextEditor) => any) => {
  const listenForNextChangeToQmdDisposable =
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === "quarto") {
        // once we switch to a quarto file once, stop listening
        listenForNextChangeToQmdDisposable.dispose();
        listener(editor);
      }
    });
};

/**
 * Restore outline expansion state after settings that affect symbol output change.
 *
 * The LSP re-registers its document symbol provider whenever the relevant
 * settings change, which forces VS Code to re-query and refresh the outline.
 * That re-query rebuilds the tree from scratch, so VS Code's heuristic for
 * symbols with newly-appearing children defaults them to collapsed (e.g.
 * toggling on code cells leaves their parent headers collapsed).
 *
 * We expand the outline once a Quarto editor is active: immediately if the
 * user already has one focused (e.g. they ran the toggle command), or on the
 * next switch back if the setting was changed from the Settings UI.
 */
export function registerOutlineConfigListener(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("quarto.symbols.showCodeCellsInOutline")) {
        if (vscode.window.activeTextEditor?.document.languageId === "quarto") {
          expandOutline(vscode.window.activeTextEditor.document.uri);
        } else {
          onNextChangeActiveTextEditorToQmd((editor) => {
            expandOutline(editor.document.uri);
          });
        }
      }
    })
  );
}
