/*
 * r-utils.ts
 *
 * Copyright (C) 2025 by Posit Software, PBC
 */

import { isRPackage as isRPackageImpl } from "quarto-utils";
import { IWorkspace } from './service';

// Version that selects workspace folder
export async function isRPackage(workspace: IWorkspace): Promise<boolean> {
  if (workspace.workspaceFolders === undefined) {
    return false;
  }

  const folderUri = workspace.workspaceFolders[0];
  return isRPackageImpl(folderUri);
}
