import * as vscode from "vscode";
import * as assert from "assert";
import { examplesOutUri, openAndShowExamplesOutTextDocument, WORKSPACE_PATH } from "./test-utils";

suite("Insert Code Cell", function () {
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  teardown(async function () {
    await vscode.commands.executeCommand("undo");
  });

  // format/basics.qmd (0-indexed lines):
  //   9:  ```{python}
  //   10: x = 1 + 1       <- inside python block
  //   11: ```
  //   13: More markdown text.  <- between blocks
  //   15: ```{r}
  //   16: y <- 1 + 1      <- inside r block
  //   17: ```
  //   19: Final line.     <- after all blocks
  //    7: Some regular text here.  <- before all blocks

  suite("Language from cursor context", function () {
    test("Uses language of block when cursor is inside a Python block", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = countOccurrences(doc.getText(), "```{python}");

      editor.selection = new vscode.Selection(10, 0, 10, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.strictEqual(countOccurrences(doc.getText(), "```{python}"), before + 1);
    });

    test("Uses language of block when cursor is inside an R block", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = countOccurrences(doc.getText(), "```{r}");

      editor.selection = new vscode.Selection(16, 0, 16, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.strictEqual(countOccurrences(doc.getText(), "```{r}"), before + 1);
    });

    test("Uses language of nearest preceding block when cursor is between blocks", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = countOccurrences(doc.getText(), "```{python}");

      editor.selection = new vscode.Selection(13, 0, 13, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.strictEqual(countOccurrences(doc.getText(), "```{python}"), before + 1);
    });

    test("Uses language of first following block when cursor precedes all blocks", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = countOccurrences(doc.getText(), "```{python}");

      editor.selection = new vscode.Selection(7, 0, 7, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.strictEqual(countOccurrences(doc.getText(), "```{python}"), before + 1);
    });

    test("Uses language of last block when cursor follows all blocks", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("format/basics.qmd");
      const before = countOccurrences(doc.getText(), "```{r}");

      editor.selection = new vscode.Selection(19, 0, 19, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.strictEqual(countOccurrences(doc.getText(), "```{r}"), before + 1);
    });
  });

  suite("Language picker fallback", function () {
    test("Inserts a code fence when document has no executable code cells", async function () {
      const content = "---\ntitle: Test\n---\n\nJust some markdown.\n";
      const uri = examplesOutUri("insert-test-empty.qmd");
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8") as Uint8Array);

      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      editor.selection = new vscode.Selection(4, 0, 4, 0);
      await vscode.commands.executeCommand("quarto.insertCodeCell");

      assert.ok(doc.getText().includes("```{"));
    });
  });
});

function countOccurrences(text: string, substring: string): number {
  return text.split(substring).length - 1;
}
