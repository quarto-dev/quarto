/*
 * symbols.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
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

    await config.update("symbols.showCodeCellsInOutline", newValue, vscode.ConfigurationTarget.Global);

    // Hack: trigger outline refresh by making a no-op edit
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === "quarto") {
      await editor.edit(edit => edit.insert(new vscode.Position(0, 0), " "));
      await editor.edit(edit => edit.delete(new vscode.Range(0, 0, 0, 1)));
    }

    vscode.window.showInformationMessage(
      `Code cells in outline will now be ${newValue ? "shown" : "hidden"}.`
    );
  }
}

export function symbolsCommands(): Command[] {
  return [new ToggleCodeCellsInOutlineCommand()];
}
