/*
 * quartoEditor.test.ts
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
import * as vscode from "vscode";
import { APPROX_TIME_TO_OPEN_VISUAL_EDITOR, examplesUri, openAndShowExamplesTextDocument, wait } from "./test-utils";
import { canPreviewDoc, findQuartoEditor, QuartoEditor } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { initQuartoContext } from "quarto-core";
import { VisualEditorProvider } from "../providers/editor/editor";

suite('Quarto Editor', function () {
  suite('findQuartoEditor', function () {
    teardown(async function () {
      // Close all editors after each test to ensure a clean slate for the next test.
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });

    test('returns undefined when there is no active or visible .qmd text editor', async function () {
      await openAndShowExamplesTextDocument("hello.lua");

      const quartoEditor = findQuartoEditorWithDefaults();

      assert.strictEqual(
        quartoEditor,
        undefined,
        "Expected not to find a Quarto editor when there are no .qmd text editors"
      );
    });

    test('finds the active .qmd text editor', async function () {
      const { editor: textEditor } = await openAndShowExamplesTextDocument("hello.qmd");
      await openAndShowExamplesTextDocument("simple-divs.qmd", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });

      const quartoEditor = findQuartoEditorWithDefaults();


      assertQuartoEditorForTextEditor(quartoEditor, textEditor);
    });

    test('finds a visible (inactive) .qmd text editor', async function () {
      const { editor: textEditor } = await openAndShowExamplesTextDocument("hello.qmd");
      await openAndShowExamplesTextDocument("hello.lua", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });

      const quartoEditor = findQuartoEditorWithDefaults();

      assertQuartoEditorForTextEditor(quartoEditor, textEditor);
    });

    // TODO: This test is really hard to write because we currently run extension tests
    //  against the bundled extension, so our `findQuartoEditor` uses a totally separate
    //  copy of `VisualEditorProvider` than the extension, so we always get `undefined`
    //  from `VisualEditorProvider.activeEditor()`.
    test.skip('finds the active .qmd visual editor', async function () {
      const uri = examplesUri("hello.qmd");
      await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        VisualEditorProvider.viewType
      );

      await vscode.commands.executeCommand(
        "vscode.openWith",
        examplesUri("simple-divs.qmd"),
        VisualEditorProvider.viewType,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }
      );

      // TODO: Could we hook into an event instead? Currently really hard because of the
      //  issue noted above.
      await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);

      const quartoEditor = findQuartoEditorWithDefaults();

      assertQuartoEditorForVisualEditor(quartoEditor, uri, vscode.ViewColumn.One);
    });

    test.skip('finds a visible (inactive) .qmd visual editor', async function () {
      const uri = examplesUri("hello.qmd");
      await vscode.commands.executeCommand("quarto.test_setkVisualModeConfirmedTrue");
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        VisualEditorProvider.viewType
      );

      await openAndShowExamplesTextDocument("hello.lua", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });

      // TODO: Could we hook into an event instead? Currently really hard because of the
      //  issue noted above.
      await wait(APPROX_TIME_TO_OPEN_VISUAL_EDITOR);

      const quartoEditor = findQuartoEditorWithDefaults();

      assertQuartoEditorForVisualEditor(quartoEditor, uri, vscode.ViewColumn.One);
    });

    test('finds the active .ipynb notebook editor', async function () {
      this.timeout(30_000); // Opening the first notebook can be slow, especially on CI

      console.log('open notebook 1');
      const notebook = await vscode.workspace.openNotebookDocument(examplesUri("convert-ipynb-to-qmd.ipynb"));
      console.log('show notebook 1');
      const notebookEditor = await vscode.window.showNotebookDocument(notebook);
      console.log('open notebook 2');
      const notebook2 = await vscode.workspace.openNotebookDocument(examplesUri("hello.ipynb"));
      console.log('show notebook 2');
      await vscode.window.showNotebookDocument(notebook2, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });

      console.log('find quarto editor');
      const quartoEditor = findQuartoEditorWithDefaults();

      console.log('assert quarto editor');
      assertQuartoEditorForNotebookEditor(quartoEditor, notebookEditor);
    });

    test('finds a visible (inactive) .ipynb notebook editor', async function () {
      const notebook = await vscode.workspace.openNotebookDocument(examplesUri("convert-ipynb-to-qmd.ipynb"));
      const notebookEditor = await vscode.window.showNotebookDocument(notebook);
      await openAndShowExamplesTextDocument("hello.lua", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });

      const quartoEditor = findQuartoEditorWithDefaults();

      assertQuartoEditorForNotebookEditor(quartoEditor, notebookEditor);
    });
  });
});

/** Convenience helper wrapping `findQuartoEditor` with defaults. */
function findQuartoEditorWithDefaults() {
  return findQuartoEditor(
    new MarkdownEngine(),
    initQuartoContext(),
    canPreviewDoc
  );
}

function assertQuartoEditorForTextEditor(
  quartoEditor: QuartoEditor | undefined,
  textEditor: vscode.TextEditor,
) {
  assert.ok(
    quartoEditor,
    "Expected to find a Quarto editor for the active text editor"
  );
  assert.strictEqual(
    quartoEditor.document,
    textEditor.document,
    "Expected the found editor's document to be the active document"
  );
  assert.strictEqual(
    quartoEditor.notebook,
    undefined,
    "Expected notebook to be undefined for a text editor"
  );
  assert.strictEqual(
    quartoEditor.textEditor,
    textEditor,
    "Expected the found editor's text editor to be the active text editor"
  );
  assert.strictEqual(
    quartoEditor.viewColumn,
    textEditor.viewColumn,
    "Expected the found editor's view column to match the active text editor's view column"
  );
}

function assertQuartoEditorForVisualEditor(
  quartoEditor: QuartoEditor | undefined,
  expectedUri: vscode.Uri,
  expectedViewColumn: vscode.ViewColumn,
) {
  assert.ok(
    quartoEditor,
    "Expected to find a Quarto editor for the active visual editor"
  );
  assert.strictEqual(
    quartoEditor.document.uri.toString(),
    expectedUri.toString(),
    "Expected the found editor's document to be the active visual editor's document"
  );
  assert.strictEqual(
    quartoEditor.textEditor,
    undefined,
    "Expected text editor to be undefined for a visual editor"
  );
  assert.strictEqual(
    quartoEditor.notebook,
    undefined,
    "Expected notebook to be undefined for a visual editor"
  );
  assert.strictEqual(
    quartoEditor.viewColumn,
    expectedViewColumn,
    "Expected the found editor's view column to be the active visual editor's view column"
  );
}

function assertQuartoEditorForNotebookEditor(
  quartoEditor: QuartoEditor | undefined,
  notebookEditor: vscode.NotebookEditor,
) {
  assert.ok(
    quartoEditor,
    "Expected to find a Quarto editor for the active notebook editor"
  );

  assert.ok(
    notebookEditor.notebook.getCells().map(c => c.document).includes(quartoEditor.document),
    "Expected the found editor's document to be a cell in the active notebook editor"
  );
  assert.strictEqual(
    quartoEditor.notebook,
    notebookEditor.notebook,
    "Expected the found editor's notebook to be the active notebook"
  );
}
