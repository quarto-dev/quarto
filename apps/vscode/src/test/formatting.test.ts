import * as vscode from "vscode";
import * as assert from "assert";
import * as path from "path";
import { openAndShowTextDocument, wait } from "./test-utils";

function createFormatterFromStringFunc(
  format: (sourceText: string) => string
): vscode.DocumentFormattingEditProvider {
  return {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
      const text = document.getText();
      const formatted = format(text);
      return [
        new vscode.TextEdit(
          new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
          ),
          formatted
        ),
      ];
    },
  };
}

function setCursorPosition(line: number, character: number) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const position = new vscode.Position(line, character);
    editor.selection = new vscode.Selection(position, position);
  }
}

suite("Code Block Formatting", function () {
  test("Format Python code block protects options from formatting", async function () {
    // Ensure Black formatter extension is installed
    await vscode.commands.executeCommand("workbench.extensions.installExtension", "ms-python.black-formatter");
    await wait(1000);
    const blackFormatterExtension = vscode.extensions.getExtension("ms-python.black-formatter");
    assert.notStrictEqual(
      blackFormatterExtension,
      undefined,
      "ms-python.black-formatter extension must be installed"
    );

    async function testFormatter(
      filename: string,
      [line, character]: [number, number],
      format: (sourceText: string) => string
    ) {
      const { doc, editor } = await openAndShowTextDocument(filename);

      const formattingEditProvider = vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file", language: "python" },
        createFormatterFromStringFunc(format)
      );

      setCursorPosition(line, character);
      await wait(450);
      await vscode.commands.executeCommand("quarto.formatCell");
      await wait(450);

      const result = doc.getText();
      formattingEditProvider.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

      return result;
    }

    const formattedResult = await testFormatter(
      "format-python.qmd",
      [7, 0],
      (sourceText) => sourceText.trim() + "\n"
    );

    // assert.ok(
    //   formattedResult.includes("x = 1\ny = 2\nz = x+y"),
    //   "Python code cell should be formatted"
    // );

    const { doc, editor } = await openAndShowTextDocument("format-python-expected.qmd");
    const expected = doc.getText();

    assert.strictEqual(formattedResult, expected, "Python code cell options should not be altered after formatting");
  });
});
