import * as vscode from "vscode";
import * as assert from "assert";
import { exampleWorkspacePath } from "./test-utils";
import { isQuartoDoc } from "../core/doc";

suite("Quarto basics", () => {
  test("Can open a Quarto document", async () => {
    const doc = await vscode.workspace.openTextDocument(exampleWorkspacePath("hello.qmd"));
    const editor = await vscode.window.showTextDocument(doc);
    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(isQuartoDoc(editor?.document), true);
  });
});
