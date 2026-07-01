/*
 * r-utils.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
 */

import * as vscode from 'vscode';
import { isRPackage as isRPackageImpl } from "quarto-utils";

// Version that selects workspace folder
export async function isRPackage(): Promise<boolean> {
  if (vscode.workspace.workspaceFolders === undefined) {
    return false;
  }

  // Pick first workspace
  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  return isRPackageImpl(workspaceFolder.uri);
}
