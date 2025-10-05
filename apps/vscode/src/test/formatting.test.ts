import * as vscode from "vscode";
import * as assert from "assert";
import * as path from "path";
import { openAndShowTextDocument, wait, WORKSPACE_PATH } from "./test-utils";
import { MarkdownEngine } from "../markdown/engine"; // DEBUGGING
import { embeddedDocumentFormattingProvider } from "../providers/format"; // DEBUGGING
import { isQuartoDoc } from "../core/doc"; // DEBUGGING

suite("Code Block Formatting", function () {
  test("Format Python code block", async function () {
    // Ensure Black formatter extension is installed
    await vscode.commands.executeCommand("workbench.extensions.installExtension", "ms-python.black-formatter");
    await wait(1000);
    const blackFormatterExtension = vscode.extensions.getExtension("ms-python.black-formatter");
    assert.notStrictEqual(blackFormatterExtension, undefined, "ms-python.black-formatter extension must be installed");

    const { doc, editor } = await openAndShowTextDocument("format-python.qmd");

    const position = new vscode.Position(7, 0); // Line with "1+1"
    editor.selection = new vscode.Selection(position, position);
    await wait(1000);

    // DEBUGGING
    // Use embeddedDocumentFormattingProvider directly
    assert.strictEqual(isQuartoDoc(editor?.document), true);
    const engine = new MarkdownEngine();
    const provider = embeddedDocumentFormattingProvider(engine);
    const next = async () => null;
    const edits = await provider(
      doc,
      { tabSize: 4, insertSpaces: true },
      new vscode.CancellationTokenSource().token,
      next
    );
    assert.notStrictEqual(edits, null, "Provider should return edits");
    assert.notStrictEqual(edits, undefined, "Provider should return edits");
    assert.ok(Array.isArray(edits), "Edits should be an array");
    assert.ok(edits.length > 0, "Provider should return at least one edit");
    const editApplied = await editor.edit((editBuilder) => {
      edits.forEach((edit) => {
        editBuilder.replace(edit.range, edit.newText);
      });
    });
    assert.strictEqual(editApplied, true, "Edits should be successfully applied");

    await wait(500);

    const formattedText = doc.getText();

    const expectedDoc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(path.join(WORKSPACE_PATH, "format-python-expected.qmd"))
    );
    const expected = expectedDoc.getText();

    assert.strictEqual(formattedText, expected, "Python code cell options should not be altered after formatting");
  });
});
