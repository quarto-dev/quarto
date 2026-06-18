import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri, openAndShowExamplesOutTextDocument } from "./test-utils";
import { languageBlockAtLine, languageNameFromBlock } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";

suite("Format Cell", function () {
  const engine = new MarkdownEngine();

  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  suite("languageBlockAtLine", function () {
    test("Returns undefined for YAML front matter lines", async function () {
      const { doc } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const tokens = engine.parse(doc);

      // Lines 0-3 are YAML front matter (---, title, format, ---)
      assert.strictEqual(languageBlockAtLine(tokens, 0), undefined);
      assert.strictEqual(languageBlockAtLine(tokens, 1), undefined);
      assert.strictEqual(languageBlockAtLine(tokens, 3), undefined);
    });

    test("Returns undefined for markdown lines", async function () {
      const { doc } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const tokens = engine.parse(doc);

      // Line 5 is "## Markdown Section", line 7 is "Some regular text here."
      assert.strictEqual(languageBlockAtLine(tokens, 5), undefined);
      assert.strictEqual(languageBlockAtLine(tokens, 7), undefined);
    });

    test("Returns undefined for fence lines (includeFence=false)", async function () {
      const { doc } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const tokens = engine.parse(doc);

      // Line 9 (0-indexed) is the opening fence ```{python}
      assert.strictEqual(languageBlockAtLine(tokens, 9, false), undefined);
      // Line 11 is the closing fence ```
      assert.strictEqual(languageBlockAtLine(tokens, 11, false), undefined);
    });

    test("Returns the block for fence lines when includeFence=true", async function () {
      const { doc } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const tokens = engine.parse(doc);

      // Line 9 (0-indexed) is the opening fence ```{python}
      const block = languageBlockAtLine(tokens, 9, true);
      assert.ok(block);
      assert.strictEqual(languageNameFromBlock(block), "python");
    });

    test("Distinguishes between different code cells", async function () {
      const { doc } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const tokens = engine.parse(doc);

      // Line 10 (0-indexed) is `x = 1 + 1` in the python block
      const pythonBlock = languageBlockAtLine(tokens, 10);
      assert.ok(pythonBlock);
      assert.strictEqual(languageNameFromBlock(pythonBlock), "python");

      // Line 16 (0-indexed) is `y <- 1 + 1` in the R block
      const rBlock = languageBlockAtLine(tokens, 16);
      assert.ok(rBlock);
      assert.strictEqual(languageNameFromBlock(rBlock), "r");
    });
  });

  // Hard to test actual formatting behavior without a formatter
  suite("quarto.formatCell command", function () {
    test("Does not modify document when cursor is on a markdown line", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = doc.getText();

      // Move cursor to a markdown line (line 7, 0-indexed: "Some regular text here.")
      editor.selection = new vscode.Selection(7, 0, 7, 0);
      await vscode.commands.executeCommand("quarto.formatCell");

      assert.strictEqual(doc.getText(), before);
    });

    test("Shows info message when cursor is on a markdown line", async function () {
      const { editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");

      // Mock `showInformationMessage`
      const original = vscode.window.showInformationMessage;
      const messages: string[] = [];
      vscode.window.showInformationMessage = async (msg: string) => {
        messages.push(msg);
        return undefined as any;
      };

      try {
        editor.selection = new vscode.Selection(7, 0, 7, 0);
        await vscode.commands.executeCommand("quarto.formatCell");

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0], "Editor selection is not within a code cell.");
      } finally {
        vscode.window.showInformationMessage = original;
      }
    });

    test("Does not show info message when cursor is inside a code cell", async function () {
      const { editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");

      // Mock `showInformationMessage`
      const original = vscode.window.showInformationMessage;
      const messages: string[] = [];
      vscode.window.showInformationMessage = async (msg: string) => {
        messages.push(msg);
        return undefined as any;
      };

      try {
        // Line 10: `x = 1 + 1` inside the python block
        editor.selection = new vscode.Selection(10, 0, 10, 0);
        await vscode.commands.executeCommand("quarto.formatCell");

        assert.strictEqual(messages.length, 0);
      } finally {
        vscode.window.showInformationMessage = original;
      }
    });
  });
});
