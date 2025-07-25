import * as path from "path";
import * as vscode from "vscode";


/**
 * Path to the root directory of the extension:
 * https://github.com/microsoft/vscode-python-tools-extension-template/blob/main/src/common/constants.ts
 */
export const EXTENSION_ROOT_DIR =
  path.basename(__dirname) === "common"
    ? path.dirname(path.dirname(__dirname))
    : path.dirname(__dirname);

export const TEST_PATH = path.join(EXTENSION_ROOT_DIR, "src", "test");
export const WORKSPACE_PATH = path.join(TEST_PATH, "examples");
export const WORKSPACE_OUT_PATH = path.join(TEST_PATH, "examples-out");

export function examplesOutUri(fileName: string = ''): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_OUT_PATH, fileName));
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
