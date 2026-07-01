/*
 * worksapce.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { workspace, WorkspaceFolder, Uri } from "vscode";

export function activeWorkspaceFolder(uri?: Uri): WorkspaceFolder | undefined {
  const workspaceFolder = uri
    ? workspace.getWorkspaceFolder(uri)
    : workspace.workspaceFolders?.length
      ? workspace.workspaceFolders[0]
      : undefined;
  return workspaceFolder;
}
