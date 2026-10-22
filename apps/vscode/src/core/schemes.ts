/* eslint-disable @typescript-eslint/naming-convention */
/*
 * schemes.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Uri } from "vscode";

export const Schemes = Object.freeze({
  http: "http:",
  https: "https:",
  file: "file:",
  untitled: "untitled",
  mailto: "mailto:",
  data: "data:",
  vscode: "vscode:",
  "vscode-insiders": "vscode-insiders:",
  notebookCell: 'vscode-notebook-cell',
});

export function hasFileScheme(uri: Uri) {
  return uri.scheme === Schemes.file.slice(0, Schemes.file.length - 1);
}

export function isOfScheme(scheme: string, link: string): boolean {
  return link.toLowerCase().startsWith(scheme + ':');
}
