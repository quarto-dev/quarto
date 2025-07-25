import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri, wait } from "./test-utils";
import { isQuartoDoc } from "../core/doc";
import { extension } from "./extension";

const APPROX_TIME_TO_OPEN_VISUAL_EDITOR = 1700;

suite("Quarto basics", function () {
  // Before running tests, copy `./examples` to a new folder `./examples-out`.
  // We copy to examples-out because the tests modify the files.
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });
  test("Can open a Quarto document", async function () {
    const doc = await vscode.workspace.openTextDocument(examplesOutUri("hello.qmd"));
    const editor = await vscode.window.showTextDocument(doc);

    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(isQuartoDoc(editor?.document), true);
  });
  // Note: this test runs after the previous test, so `hello.qmd` can already be touched by the previous
  //       test. That's okay for this test, but could cause issues if you expect a qmd to look how it
  //       does in `/examples`.
  test("Roundtrip doesn't change hello.qmd", async function () {
    const doc = await vscode.workspace.openTextDocument(examplesOutUri("hello.qmd"));
    const editor = await vscode.window.showTextDocument(doc);

    const docTextBefore = doc.getText();

    // switch to visual editor and back
    await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
    await wait(300);
    await vscode.commands.executeCommand("quarto.editInVisualMode");
    await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);
    await vscode.commands.executeCommand("quarto.editInSourceMode");
    await wait(300);

    const docTextAfter = doc.getText();
    assert.equal(docTextBefore, docTextAfter);
  });
});
