/*
 * notebook-export.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { examplesOutUri, WORKSPACE_PATH } from "./test-utils";
import { extension } from "./extension";
import { QuickPickItem } from "vscode";
import { getNotebookExportExtension, notebookExporterLabel } from "../providers/notebook-export";

// Skipped until we can run extension tests against Positron.
suite.skip("Notebook export", function () {
  suiteSetup(async function () {
    const notebookExportExtension = getNotebookExportExtension();
    if (!notebookExportExtension) {
      // The notebook export extension is not available (we're in VS Code),
      // skip this suite.
      this.skip();
    }

    // Wait for this extension and the notebook export extension to activate.
    await extension().activate();
    await notebookExportExtension.activate();

    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(
      vscode.Uri.file(WORKSPACE_PATH),
      examplesOutUri()
    );
  });

  let originalShowQuickPick: typeof vscode.window.showQuickPick;
  setup(function () {
    originalShowQuickPick = vscode.window.showQuickPick;
  });

  teardown(async function () {
    vscode.window.showQuickPick = originalShowQuickPick;
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("exports a .ipynb notebook to .qmd", async function () {
    const uri = examplesOutUri('convert-ipynb-to-qmd.ipynb');
    const notebook = await vscode.workspace.openNotebookDocument(uri);
    await vscode.window.showNotebookDocument(notebook);

    (vscode.window as any).showQuickPick = async (items: readonly QuickPickItem[]) => {
      // Return the Quarto exporter item, as if it were selected by the user.
      const item = (await items).find(item => item.label === notebookExporterLabel);
      return item;
    };

    await vscode.commands.executeCommand('notebook.export', notebook.uri);

    const exported = vscode.window.activeTextEditor?.document;
    assert.ok(exported, 'Expected an active text editor after exporting');

    // The exporter uses the same mechanism already tested in `convert.test.ts`,
    // so it should be sufficient to check that the converted file is opened.
    assert.ok(
      exported.uri.toString() === examplesOutUri('convert-ipynb-to-qmd.qmd').toString(),
      'Expected the exported document to be opened'
    );
  });
});
