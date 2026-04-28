import * as assert from "assert";
import * as fs from "node:fs";
import * as vscode from "vscode";
import {
  WORKSPACE_PATH,
  examplesOutUri,
  openAndShowExamplesOutTextDocument,
} from "./test-utils";

suite("Convert Commands", function () {
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(
      vscode.Uri.file(WORKSPACE_PATH),
      examplesOutUri()
    );
  });

  teardown(async function () {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  suite("Convert .qmd to .ipynb", function () {
    const sourceFile = examplesOutUri("convert-qmd-to-ipynb.qmd");
    const convertedFile = examplesOutUri("convert-qmd-to-ipynb.ipynb");

    setup(function () {
      fs.rmSync(convertedFile.fsPath, { force: true, recursive: true });
    });

    test("creates the .ipynb file", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(doc);

      await vscode.commands.executeCommand("quarto.convertToIpynb");

      assert.ok(fs.existsSync(convertedFile.fsPath), ".ipynb file should be created");

      const content = JSON.parse(fs.readFileSync(convertedFile.fsPath, "utf-8"));
      assert.ok(Array.isArray(content.cells), "should have a cells array");
    });

    test("opens the converted .ipynb in the notebook editor", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(doc);

      await vscode.commands.executeCommand("quarto.convertToIpynb");

      assert.strictEqual(
        vscode.window.activeNotebookEditor?.notebook.uri.toString(),
        convertedFile.toString(),
        "converted .ipynb opened in the text editor instead of the notebook editor"
      );
    });

    test("saves the file before converting", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      const editor = await vscode.window.showTextDocument(doc);

      await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(doc.lineCount, 0), "\n# Added line\n");
      });
      assert.ok(doc.isDirty, "Document should be dirty after edit");

      await vscode.commands.executeCommand("quarto.convertToIpynb");

      assert.ok(fs.existsSync(convertedFile.fsPath), ".ipynb file should be created");
      assert.ok(!doc.isDirty, "Document should be saved after convert");

      const notebook = JSON.parse(fs.readFileSync(convertedFile.fsPath, "utf-8"));
      const sources = notebook.cells.map((c: { source: string[]; }) => c.source.join(""));
      assert.ok(
        sources.some((s: string) => s.includes("Added line")),
        "converted file should contain the added line"
      );
    });

    test("overwrites when the user confirms", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(doc);

      fs.writeFileSync(convertedFile.fsPath, "old content");

      const original = vscode.window.showWarningMessage;
      vscode.window.showWarningMessage = async () => "Overwrite";

      try {
        await vscode.commands.executeCommand("quarto.convertToIpynb");

        const content = JSON.parse(fs.readFileSync(convertedFile.fsPath, "utf-8"));
        assert.ok(Array.isArray(content.cells), "file should be overwritten with valid notebook");
      } finally {
        vscode.window.showWarningMessage = original;
      }
    });

    test("does not overwrite when the user declines", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(doc);

      const sentinel = "should-not-be-overwritten";
      fs.writeFileSync(convertedFile.fsPath, sentinel);

      const original = vscode.window.showWarningMessage;
      vscode.window.showWarningMessage = async () => undefined;

      try {
        await vscode.commands.executeCommand("quarto.convertToIpynb");

        assert.strictEqual(
          fs.readFileSync(convertedFile.fsPath, "utf-8"),
          sentinel,
          "existing file should be preserved"
        );
      } finally {
        vscode.window.showWarningMessage = original;
      }
    });

    test("shows a warning when conversion fails", async function () {
      const doc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(doc);

      // Place a directory where the output file would go so quarto convert fails.
      fs.mkdirSync(convertedFile.fsPath);

      const original = vscode.window.showWarningMessage;
      const messages: string[] = [];
      vscode.window.showWarningMessage = async (msg: string, ...args: unknown[]) => {
        messages.push(msg);
        if (msg.includes("already exists")) {
          // Choose to overwrite the existing path.
          return "Overwrite";
        }
        // Dismiss any other warnings.
        return undefined;
      };

      try {
        await vscode.commands.executeCommand("quarto.convertToIpynb");

        assert.ok(
          messages.some((m) => m.includes("convert failed")),
          `expected a 'convert failed' warning, got: ${JSON.stringify(messages)}`
        );
      } finally {
        vscode.window.showWarningMessage = original;
        fs.rmSync(convertedFile.fsPath, { recursive: true });
      }
    });

    test("shows CLI errors in a human-readable format", async function () {
      const invalidFile = examplesOutUri("convert-invalid-yaml.qmd");
      const convertedFile = examplesOutUri("convert-invalid-yaml.ipynb");

      const doc = await vscode.workspace.openTextDocument(invalidFile);
      await vscode.window.showTextDocument(doc);

      const original = vscode.window.showWarningMessage;
      const messages: string[] = [];
      vscode.window.showWarningMessage = async (msg: string) => {
        messages.push(msg);
        console.log("showWarningMessage:", msg);
        return undefined;
      };

      try {
        await vscode.commands.executeCommand("quarto.convertToIpynb");

        // Check that there's no ANSI escape codes or stack traces
        // (those are in the output channel logs, not the user-facing warning).
        assert.deepStrictEqual(messages, [
          'Quarto convert failed. Reason: ERROR: YAMLException: unexpected end of the stream within a double quoted scalar (4:1)'
        ]);
      } finally {
        vscode.window.showWarningMessage = original;
        fs.rmSync(convertedFile.fsPath, { force: true });
      }
    });
  });

  suite("Convert .ipynb to .qmd", function () {
    const sourceFile = examplesOutUri("convert-ipynb-to-qmd.ipynb");
    const convertedFile = examplesOutUri("convert-ipynb-to-qmd.qmd");

    setup(function () {
      fs.rmSync(convertedFile.fsPath, { force: true, recursive: true });
    });

    test("creates the .qmd file", async function () {
      const notebook = await vscode.workspace.openNotebookDocument(sourceFile);
      await vscode.window.showNotebookDocument(notebook);

      await vscode.commands.executeCommand("quarto.convertToQmd");

      assert.ok(fs.existsSync(convertedFile.fsPath), ".qmd file should be created");

      const content = fs.readFileSync(convertedFile.fsPath, "utf-8");
      assert.ok(content.startsWith("---"), ".qmd file should start with YAML front matter");
    });

    test("opens the converted .qmd in the text editor", async function () {
      const notebook = await vscode.workspace.openNotebookDocument(sourceFile);
      await vscode.window.showNotebookDocument(notebook);

      await vscode.commands.executeCommand("quarto.convertToQmd");

      assert.strictEqual(
        vscode.window.activeTextEditor?.document.uri.toString(),
        convertedFile.toString(),
        "converted .qmd did not open in the text editor"
      );
    });

    test("saves the notebook before converting", async function () {
      const notebook = await vscode.workspace.openNotebookDocument(sourceFile);
      await vscode.window.showNotebookDocument(notebook);

      const edit = new vscode.WorkspaceEdit();
      edit.set(notebook.uri, [
        vscode.NotebookEdit.insertCells(notebook.cellCount, [
          new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            "added_cell = True",
            "python"
          ),
        ]),
      ]);
      await vscode.workspace.applyEdit(edit);
      assert.ok(notebook.isDirty, "Notebook should be dirty after edit");

      await vscode.commands.executeCommand("quarto.convertToQmd");

      assert.ok(fs.existsSync(convertedFile.fsPath), ".qmd file should be created");
      assert.ok(!notebook.isDirty, "Notebook should be saved after convert");

      const content = fs.readFileSync(convertedFile.fsPath, "utf-8");
      assert.ok(
        content.includes("added_cell"),
        "converted file should contain the added cell"
      );
    });

    test("does nothing when there is no active notebook editor", async function () {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      await openAndShowExamplesOutTextDocument("convert-qmd-to-ipynb.qmd");

      await vscode.commands.executeCommand("quarto.convertToQmd");

      assert.ok(
        !fs.existsSync(convertedFile.fsPath),
        ".qmd file should not be created without an active notebook"
      );
    });

    // The extension guard for non-.ipynb notebooks can't be tested here
    // because VS Code has no registered serializer for arbitrary notebook
    // extensions like ".notebook". The "no active notebook editor" test above
    // covers the analogous early-return path.
  });
});
