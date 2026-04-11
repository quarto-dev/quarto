import * as vscode from "vscode";
import * as assert from "assert";
import { openAndShowExamplesTextDocument, wait } from "./test-utils";

/**
 * Creates a document formatting provider from a formatting function.
 * @param format - Function that transforms source text
 * @returns Document formatting edit provider
 */
function createFormatterFromStringFunc(
  format: (sourceText: string) => string
): vscode.DocumentFormattingEditProvider {
  return {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument
    ): vscode.TextEdit[] {
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
) {
  const { doc } = await openAndShowExamplesTextDocument(filename);

  const formattingEditProvider =
    vscode.languages.registerDocumentFormattingEditProvider(
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

/**
 * Inserts spaces around `=` and `+`, and splits `;`-separated statements
 * so fake formatter output is deterministic and visibly different from
 * the input.
 */
function spaceAssignments(sourceText: string): string {
  return spaceBinaryOperators(sourceText.replace(/;/g, "\n"));
}

/**
 * Hostile formatter that would rewrite option directives and mangle
 * assignments if it were ever allowed to see them. Used to prove that
 * option lines never reach the formatter.
 */
function hostileFormatter(sourceText: string): string {
  return spaceBinaryOperators(sourceText.replace(/#\| /g, "# PIPE "));
}

/**
 * Reformats assignments and adds a space after the `#` of standalone
 * comments. Exists so that tests with multiline, comment-containing code
 * cells can prove both the code and the comments are touched by the
 * formatter, while the option directives are not.
 */
function formatCodeAndComments(sourceText: string): string {
  return spaceBinaryOperators(sourceText).replace(/^#(\S)/gm, "# $1");
}

function spaceBinaryOperators(src: string): string {
  return src
    .replace(/(\w)=(\w)/g, "$1 = $2")
    .replace(/(\w)\+(\w)/g, "$1 + $2");
}

suite("Code Block Formatting", function () {
  test("single option directive is preserved while code is formatted", async function () {
    const formattedResult = await testFormatter(
      "format-python.qmd",
      [8, 0],
      spaceAssignments
    );

    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("y = 2"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("#| label: my-code"),
      "Option directive should be preserved"
    );
    assert.ok(
      !formattedResult.includes("x=1;y=2;z=x+y"),
      "Original unformatted source should be gone"
    );
  });

  test("multiple option directives are all preserved in order", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiple-options.qmd",
      [10, 0],
      spaceAssignments
    );

    const labelIndex = formattedResult.indexOf("#| label: multi");
    const echoIndex = formattedResult.indexOf("#| echo: false");
    const warningIndex = formattedResult.indexOf("#| warning: false");
    assert.ok(labelIndex >= 0, "`#| label: multi` should be preserved");
    assert.ok(echoIndex >= 0, "`#| echo: false` should be preserved");
    assert.ok(warningIndex >= 0, "`#| warning: false` should be preserved");
    assert.ok(
      labelIndex < echoIndex && echoIndex < warningIndex,
      "Option directives should keep their original order"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      !formattedResult.includes("x=1;y=2;z=x+y"),
      "Original unformatted source should be gone"
    );
  });

  test("blocks without option directives are formatted normally", async function () {
    const formattedResult = await testFormatter(
      "format-python-no-options.qmd",
      [7, 0],
      spaceAssignments
    );

    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      !formattedResult.includes("#|"),
      "No option directives should be introduced"
    );
  });

  test("blocks containing only option directives are left untouched", async function () {
    const formattedResult = await testFormatter(
      "format-python-only-options.qmd",
      [7, 0],
      (src) => src.replace(/only-options/g, "REPLACED")
    );

    assert.ok(
      formattedResult.includes("#| label: only-options"),
      "Option directive should be preserved verbatim when there is no code to format"
    );
    assert.ok(
      !formattedResult.includes("REPLACED"),
      "Hostile formatter must not reach option-only blocks"
    );
  });

  test("multiline code with badly formatted comments is reformatted while options stay intact", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiline-with-comments.qmd",
      [10, 0],
      formatCodeAndComments
    );

    assert.ok(
      formattedResult.includes("#| label: multiline"),
      "`#| label: multiline` should be preserved exactly"
    );
    assert.ok(
      formattedResult.includes("#| echo: false"),
      "`#| echo: false` should be preserved exactly"
    );
    assert.ok(
      !formattedResult.includes("# | label"),
      "The hashpipe must not be rewritten by the comment-normalising regex"
    );
    assert.ok(
      formattedResult.includes("# standalone comment"),
      "Standalone code comment should be reformatted with a leading space"
    );
    assert.ok(
      !/^#standalone comment$/m.test(formattedResult),
      "Original unformatted standalone comment should be gone"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "First assignment should be reformatted"
    );
    assert.ok(
      formattedResult.includes("y = 2"),
      "Second assignment should be reformatted"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Third assignment should be reformatted"
    );
  });

  test("option directives are hidden from hostile formatters", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiple-options.qmd",
      [10, 0],
      hostileFormatter
    );

    assert.ok(
      formattedResult.includes("#| label: multi"),
      "`#| label: multi` must not be rewritten"
    );
    assert.ok(
      formattedResult.includes("#| echo: false"),
      "`#| echo: false` must not be rewritten"
    );
    assert.ok(
      formattedResult.includes("#| warning: false"),
      "`#| warning: false` must not be rewritten"
    );
    assert.ok(
      !formattedResult.includes("# PIPE "),
      "Hostile rewrite of the hashpipe must not appear anywhere"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should still be reformatted by the hostile formatter"
    );
  });
});
