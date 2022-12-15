/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from "vscode";

export const Schemes = {
  http: "http:",
  https: "https:",
  file: "file:",
  untitled: "untitled",
  mailto: "mailto:",
  data: "data:",
  vscode: "vscode:",
  "vscode-insiders": "vscode-insiders:",
};

export function hasFileScheme(uri: Uri) {
  return uri.scheme === Schemes.file.slice(0, Schemes.file.length - 1);
}
