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
