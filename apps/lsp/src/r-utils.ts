/*
 * r-utils.ts
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

import { isRPackage as isRPackageImpl } from "@utils/r-utils";
import { IWorkspace } from './service';

// Version that selects workspace folder
export async function isRPackage(workspace: IWorkspace): Promise<boolean> {
  if (workspace.workspaceFolders === undefined) {
    return false;
  }

  const folderUri = workspace.workspaceFolders[0];
  return isRPackageImpl(folderUri);
}
