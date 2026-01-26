import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, readOrCreateSnapshot, examplesOutUri, wait, roundtrip, openAndShowTextDocument } from "./test-utils";
import { isQuartoDoc } from "../core/doc";


suite("Quarto basics", function () {
  // Before running tests, copy `./examples` to a new folder `./examples-out`.
  // We copy to examples-out because the tests modify the files.
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  test("Can open a Quarto document", async function () {
    const { editor } = await openAndShowTextDocument("hello.qmd");

    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(isQuartoDoc(editor?.document), true);
  });

  // Note: this test runs after the previous test, so `hello.qmd` can already be touched by the previous
  //       test. That's okay for this test, but could cause issues if you expect a qmd to look how it
  //       does in `/examples`.
  test("Roundtrip doesn't change hello.qmd", async function () {
    const { doc } = await openAndShowTextDocument("hello.qmd");

    const { before, after } = await roundtrip(doc);

    assert.equal(before, after);
  });

  roundtripSnapshotTest('valid-basics.qmd');

  roundtripSnapshotTest('valid-basics-2.qmd');

  roundtripSnapshotTest('valid-nesting.qmd');

  roundtripSnapshotTest('invalid.qmd');

  roundtripSnapshotTest('capsule-leak.qmd');

  roundtripSnapshotTest('attr-equals.qmd');

  // a test to prevent situations like https://github.com/quarto-dev/quarto/issues/845
  test("Can open a non-qmd file normally", async function () {
    const { editor, doc } = await openAndShowTextDocument("hello.lua");

    editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(0, 0), 'print("hiyo")\n');
    });
    doc.save();

    await wait(1700); // approximate time to open visual editor, just in case

    assert.equal(vscode.window.activeTextEditor, editor, 'quarto extension interferes with other files opened in VSCode!');
  });

  test("quarto.formatCell deals with formatters that do or don't add trailing newline consistently", async function () {

    async function testFormatter(filename: string, [line, character]: [number, number], format: (sourceText: string) => string) {
      const { doc } = await openAndShowTextDocument(filename);

      const formattingEditProvider = vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: 'file', language: 'r' },
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

    const newlineFormatterResult = await testFormatter(
      "cell-format.qmd",
      [3, 1],
      (sourceText) => sourceText + 'FORMAT SUCCESS\n'
    );
    const noopFormatterResult = await testFormatter(
      "cell-format.qmd",
      [3, 1],
      (sourceText) => sourceText + 'FORMAT SUCCESS'
    );

    assert.ok(newlineFormatterResult.includes('FORMAT SUCCESS'), 'newlineFormatter failed');
    assert.ok(noopFormatterResult.includes('FORMAT SUCCESS'), 'noopFormatter failed');

    assert.equal(newlineFormatterResult, noopFormatterResult);
  });

  suiteTeardown(() => {
    vscode.window.showInformationMessage('All tests done!');
  });
});

function createFormatterFromStringFunc(format: (sourceText: string) => string) {
  return {
    provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.ProviderResult<vscode.TextEdit[]> {
      const fileStart = new vscode.Position(0, 0);
      const fileEnd = document.lineAt(document.lineCount - 1).range.end;

      return [new vscode.TextEdit(new vscode.Range(fileStart, fileEnd), format(document.getText()))];
    }
  };
}

function setCursorPosition(line: number, character: number) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const position = new vscode.Position(line, character);
    const newSelection = new vscode.Selection(position, position);
    editor.selection = newSelection;
    editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenter); // Optional: scroll to the new position
  }
}

/**
 *
 * When the test is run on the dev's machine for the first time, saves the roundtripped file as a snapshot.
 * All subsequent runs of the test compare the roundtripped file to that snapshot.
 *
 * Useful for capturing the behaviour of roundtripping at a point in time and testing against that.
 *
 * @param filename A .qmd file in the examples folder to snapshot test
 */
function roundtripSnapshotTest(filename: string) {
  const snapshotFileName = `roundtripped-${filename}`;

  test(`Roundtripped ${filename} matches snapshot`, async function () {
    const { doc } = await openAndShowTextDocument(filename);

    const { after } = await roundtrip(doc);

    assert.equal(after, await readOrCreateSnapshot(snapshotFileName, after));
  });
}
