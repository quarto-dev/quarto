/*
 * configurations.ts
 *
 * Copyright (C) 2024 by Posit Software, PBC
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

export function defaultEditorOpener(): string | undefined {
  const target = 'workbench.editorAssociations';

  const inspectType = vscode.workspace.getConfiguration(undefined).inspect(target)?.globalValue as { "*.qmd"?: string };
  if (!inspectType) { return "default"; }

  if (inspectType.hasOwnProperty("*.qmd")) {
    return inspectType["*.qmd"];
  }
  return "default";
}
