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

function examplesUri(fileName: string = ''): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_PATH, fileName));
}
export function examplesOutUri(fileName: string = ''): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_OUT_PATH, fileName));
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function openAndShowTextDocument(fileName: string) {
  const doc = await vscode.workspace.openTextDocument(examplesOutUri(fileName));
  const editor = await vscode.window.showTextDocument(doc);
  return { doc, editor };
}

const APPROX_TIME_TO_OPEN_VISUAL_EDITOR = 1700;
export async function roundtrip(doc: vscode.TextDocument) {
  const before = doc.getText();

  // switch to visual editor and back
  await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
  await wait(300);
  await vscode.commands.executeCommand("quarto.editInVisualMode");
  await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);
  await vscode.commands.executeCommand("quarto.editInSourceMode");
  await wait(300);

  const after = doc.getText();

  return { before, after };
}

export async function readOrCreateSnapshot(fileName: string, content: string) {
  const snapshotUri = examplesUri(path.join('generated_snapshots', fileName));
  try {
    const doc = await vscode.workspace.openTextDocument(snapshotUri);
    return doc.getText();
  } catch {
    await vscode.workspace.fs.writeFile(
      snapshotUri,
      Buffer.from(content, 'utf8')
    );
    return content;
  }
}
