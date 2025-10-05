import * as vscode from "vscode";
import * as assert from "assert";
import * as path from "path";
import { openAndShowTextDocument, wait, WORKSPACE_PATH } from "./test-utils";

suite("Code Block Formatting", function () {
  test("Format Python code block", async function () {
    // Ensure Black formatter extension is installed
    await vscode.commands.executeCommand("workbench.extensions.installExtension", "ms-python.black-formatter");
    await wait(1000);

    const { doc, editor } = await openAndShowTextDocument("format-python.qmd");

    const position = new vscode.Position(7, 2); // Line with "1+1"
    editor.selection = new vscode.Selection(position, position);
    await vscode.commands.executeCommand("quarto.formatCell");
    // await vscode.commands.executeCommand("vscode.executeFormatDocumentProvider", doc.uri);

    await wait(500);

    const formattedText = doc.getText();

    const expectedDoc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(path.join(WORKSPACE_PATH, "format-python-expected.qmd"))
    );
    const expected = expectedDoc.getText();

    assert.strictEqual(formattedText, expected, "Python code cell options should not be altered after formatting");
  });
});
