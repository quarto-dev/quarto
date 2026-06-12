import * as vscode from "vscode";

export function notebookFrontMatterYaml(notebook: vscode.NotebookDocument): string {
  return notebook.cellAt(0)?.document.getText() || "";
}
