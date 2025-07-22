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

export function exampleWorkspacePath(file: string): string {
  return path.join(WORKSPACE_PATH, file);
}
export function exampleWorkspaceOutPath(file: string): string {
  return path.join(WORKSPACE_PATH, 'examples-out', file);
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function copyFile(
  sourcePath: string,
  destPath: string,
): Promise<boolean> {
  try {
    const wsedit = new vscode.WorkspaceEdit();
    const data = await vscode.workspace.fs.readFile(
      vscode.Uri.file(sourcePath)
    );
    const destFileUri = vscode.Uri.file(destPath);
    wsedit.createFile(destFileUri, { ignoreIfExists: true });

    await vscode.workspace.fs.writeFile(destFileUri, data);

    let isDone = await vscode.workspace.applyEdit(wsedit);
    if (isDone) return true;
    else return false;
  } catch (err) {
    return false;
  }
}
