import * as vscode from "vscode";
import * as assert from "assert";
import * as path from "path";
import { openAndShowTextDocument, wait } from "./test-utils";

/**
 * Creates a document formatting provider from a formatting function.
 * @param format - Function that transforms source text
 * @returns Document formatting edit provider
 */
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

/**
 * Sets the cursor position in the active editor.
 * @param line - Line number
 * @param character - Character position
 */
function setCursorPosition(line: number, character: number): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const position = new vscode.Position(line, character);
    editor.selection = new vscode.Selection(position, position);
  }
}

suite("Code Block Formatting", function () {
  test("Format Python code block protects options from formatting", async function () {
    /**
     * Tests formatter on a file at a given cursor position.
     * @param filename - Name of test file
     * @param position - Tuple of line and character position
     * @param format - Formatting function
     * @returns Formatted document text
     */
    async function testFormatter(
      filename: string,
      [line, character]: [number, number],
      format: (sourceText: string) => string
    ): Promise<string> {
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
      (sourceText: string): string => sourceText.trim() + "\n"
    );

    const { doc } = await openAndShowTextDocument("format-python-expected.qmd");
    const expected = doc.getText();

    assert.strictEqual(formattedResult, expected, "Python code cell options should not be altered after formatting");
  });
});
