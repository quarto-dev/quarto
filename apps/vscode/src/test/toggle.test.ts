import * as vscode from "vscode";
import * as assert from "assert";
import { isQuartoDoc } from "../core/doc";
// import { VisualEditorProvider } from "../providers/editor/editor";

suite("Toggle editors", () => {
  test("Switch from source to visual", async () => {
    await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse("hello.qmd"));
    const editor = vscode.window.activeTextEditor;
    assert.strictEqual(isQuartoDoc(editor?.document), true);
    assert.strictEqual(editor?.document.languageId, "python");

    assert.strictEqual(1, 2);

    // const beforeSwitchingEditor = VisualEditorProvider.activeEditor();
    // assert.strictEqual(beforeSwitchingEditor, undefined);

    // await vscode.commands.executeCommand("quarto.editInVisualMode");
    // const afterSwitchingEditor = VisualEditorProvider.activeEditor();
    // assert.strictEqual(afterSwitchingEditor?.textEditor, undefined);
  });
});
