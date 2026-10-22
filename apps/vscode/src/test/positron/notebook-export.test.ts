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
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { extension } from "../extension";
import { notebookExporterLabel } from "../../providers/notebook-export";
import { NotebookExportExtension } from "../../@types/positron-notebook-export";

const kNotebookExportExtensionId = "positron.notebook-export";

suite("Positron: notebook export", function () {
  test("registers the Quarto Markdown exporter with positron.notebook-export", async function () {
    this.timeout(30000);

    const exportExt = vscode.extensions.getExtension<NotebookExportExtension>(
      kNotebookExportExtensionId
    );
    assert.ok(
      exportExt,
      `Expected the built-in ${kNotebookExportExtensionId} extension to be present in Positron`
    );

    const exportApi = await exportExt.activate();

    // Activating Quarto is what registers the exporter against the notebook
    // export API.
    const quarto = extension();
    if (!quarto.isActive) {
      await quarto.activate();
    }

    // Quarto registers the exporter asynchronously (after the notebook-export
    // extension finishes activating), so poll until it shows up rather than
    // asserting immediately.
    const quartoExporter = await waitFor(
      () => exportApi.exporters.find((e) => e.label === notebookExporterLabel),
      15000
    );

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
});

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
