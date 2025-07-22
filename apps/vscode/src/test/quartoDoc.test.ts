import * as vscode from "vscode";
import * as assert from "assert";
import { exampleWorkspacePath, exampleWorkspaceOutPath, copyFile, wait } from "./test-utils";
import { isQuartoDoc } from "../core/doc";

const APPROX_TIME_TO_OPEN_VISUAL_EDITOR = 1600;

suite("Quarto basics", () => {
  // Before we run any tests, we should copy any files that get edited in the tests to file under `exampleWorkspaceOutPath`
  suiteSetup(async () => {
    const didCopyFile = await copyFile(exampleWorkspacePath('hello.qmd'), exampleWorkspaceOutPath('hello.qmd'));
    assert.ok(didCopyFile);
  });

  test("Can open a Quarto document", async () => {
    const doc = await vscode.workspace.openTextDocument(exampleWorkspaceOutPath("hello.qmd"));
    const editor = await vscode.window.showTextDocument(doc);

    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(isQuartoDoc(editor?.document), true);
  });
  // Note: the following tests may be flaky. They rely on waiting estimated amounts of time for commands to complete.
  test("Can edit in visual mode", async () => {
    const doc = await vscode.workspace.openTextDocument(exampleWorkspaceOutPath("hello.qmd"));
    const editor = await vscode.window.showTextDocument(doc);

    // manually confirm visual mode so dialogue pop-up doesn't show because dialogues cause test errors
    // and switch to visual editor
    await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
    await wait(300); // It seems necessary to wait around 300ms for this command to be done.
    await vscode.commands.executeCommand("quarto.editInVisualMode");
    await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);

    assert.ok(await vscode.commands.executeCommand("quarto.test_isInVisualEditor"));
  });
  // Note: this test runs after the previous test, so `hello.qmd` has already been touched by the previous
  //       test. That's okay for this test, but could cause issues if you expect a qmd to look how it
  //       does in `/examples`.
  test("Roundtrip doesn't change hello.qmd", async () => {
    const doc = await vscode.workspace.openTextDocument(exampleWorkspaceOutPath("hello.qmd"));
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
    assert.ok(docTextBefore === docTextAfter);
  });
});
