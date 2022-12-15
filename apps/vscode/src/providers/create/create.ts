/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import { ExtensionContext, workspace, window, ViewColumn } from "vscode";
import { QuartoContext } from "quarto-core";
import { collectFirstRun } from "./firstrun";
import { CreateProjectCommand } from "./create-project";

export async function activateCreate(
  context: ExtensionContext,
  quartoContext: QuartoContext
) {
  // open documents if there is a first-run file
  if (quartoContext.workspaceDir) {
    const firstRun = await collectFirstRun(context, quartoContext.workspaceDir);
    for (const file of firstRun) {
      const doc = await workspace.openTextDocument(file);
      await window.showTextDocument(doc, ViewColumn.Active, false);
    }
  }

  // commands
  return [
    new CreateProjectCommand("quarto.createProject", context, quartoContext),
    new CreateProjectCommand(
      "quarto.fileCreateProject",
      context,
      quartoContext
    ),
  ];
}
