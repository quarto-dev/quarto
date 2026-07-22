/*
 * notebook-export.test.ts
 *
 * Positron-only integration test.
 *
 * Verifies that Quarto registers its notebook exporter with Positron's
 * `positron.notebook-export` extension API. This is pure cross-extension wiring
 * that only exists in Positron (`src/providers/notebook-export.ts`) and is not
 * exercised by the vanilla VS Code suite, where the `positron.notebook-export`
 * extension is absent.
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { extension } from "../extension";
import { notebookExporterLabel } from "../../providers/notebook-export";
import { NotebookExportExtension } from "../../@types/positron-notebook-export";

const kNotebookExportExtensionId = "positron.notebook-export";
const kExamplesDir = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "test",
  "examples"
);
const kExamplesOutDir = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "test",
  "examples-out"
);

suite("Positron: notebook export", function () {
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(vscode.Uri.file(kExamplesOutDir), { recursive: true }).then(
      () => undefined,
      () => undefined
    );
    await vscode.workspace.fs.copy(
      vscode.Uri.file(kExamplesDir),
      vscode.Uri.file(kExamplesOutDir)
    );
  });

  teardown(async function () {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("registers the Quarto Markdown exporter with positron.notebook-export", async function () {
    this.timeout(30000);

    const quartoExporter = await waitForQuartoExporter();

    assert.ok(
      quartoExporter,
      `Expected an exporter labelled "${notebookExporterLabel}" to be registered`
    );
    assert.strictEqual(
      quartoExporter.fileExtension,
      ".qmd",
      "Quarto exporter should target the .qmd file extension"
    );
  });

  test("exports a .ipynb notebook to .qmd through notebook.export", async function () {
    this.timeout(30000);

    const sourceFile = vscode.Uri.file(
      path.join(kExamplesOutDir, "convert-ipynb-to-qmd.ipynb")
    );
    const convertedFile = vscode.Uri.file(
      path.join(kExamplesOutDir, "convert-ipynb-to-qmd.qmd")
    );
    fs.rmSync(convertedFile.fsPath, { force: true, recursive: true });

    const quartoExporter = await waitForQuartoExporter();

    const notebook = await vscode.workspace.openNotebookDocument(sourceFile);
    await vscode.window.showNotebookDocument(notebook);

    await quartoExporter!.export(notebook);

    assert.ok(fs.existsSync(convertedFile.fsPath), ".qmd file should be created");
    assert.strictEqual(
      vscode.window.activeTextEditor?.document.uri.toString(),
      convertedFile.toString(),
      "converted .qmd did not open in the text editor"
    );
  });
});

async function waitForQuartoExporter() {
  const exportExt = vscode.extensions.getExtension<NotebookExportExtension>(
    kNotebookExportExtensionId
  );
  assert.ok(
    exportExt,
    `Expected the built-in ${kNotebookExportExtensionId} extension to be present in Positron`
  );

  const exportApi = await exportExt.activate();
  const quarto = extension();
  if (!quarto.isActive) {
    await quarto.activate();
  }

  // Quarto registers the exporter asynchronously (after the notebook-export
  // extension finishes activating), so poll until it shows up rather than
  // asserting immediately.
  return await waitFor(
    () => exportApi.exporters.find((e) => e.label === notebookExporterLabel),
    15000
  );
}

/** Poll `fn` until it returns a truthy value or `timeoutMs` elapses. */
async function waitFor<T>(
  fn: () => T | undefined,
  timeoutMs: number
): Promise<T | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = fn();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return fn();
}
