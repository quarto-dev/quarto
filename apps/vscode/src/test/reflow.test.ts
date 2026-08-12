import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri, openAndShowExamplesOutTextDocument } from "./test-utils";
import { reflowComments } from "../providers/cell/reflow";

suite("Reflow Comment in Cell", function () {

  suite("reflowComments", function () {
    test("Wraps a long comment to the column", function () {
      const reflows = reflowComments(
        ["# aaa bbb ccc ddd", "x <- 1"],
        "#",
        10
      );
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0], {
        startLine: 0,
        endLine: 0,
        newLines: ["# aaa bbb", "# ccc ddd"],
      });
    });

    test("Joins short comment lines up to the column", function () {
      const reflows = reflowComments(["# aaa", "# bbb", "# ccc"], "#", 80);
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0].newLines, ["# aaa bbb ccc"]);
      assert.strictEqual(reflows[0].endLine, 2);
    });

    test("Returns no edits when comments already fit", function () {
      const reflows = reflowComments(["# aaa bbb", "x <- 1"], "#", 80);
      assert.deepStrictEqual(reflows, []);
    });

    test("Never touches cell option directives", function () {
      const reflows = reflowComments(
        ["#| echo: false", "#|  label: a-very-long-label", "# aaa bbb ccc", "x <- 1"],
        "#",
        10
      );
      assert.strictEqual(reflows.length, 1);
      assert.strictEqual(reflows[0].startLine, 2);
      assert.strictEqual(reflows[0].endLine, 2);
    });

    test("Blank comment lines separate paragraphs", function () {
      const reflows = reflowComments(["# aaa bbb ccc", "#", "# ddd"], "#", 10);
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0].newLines, [
        "# aaa bbb",
        "# ccc",
        "#",
        "# ddd",
      ]);
      // ...and trailing whitespace on blank comment lines is normalized
      const normalized = reflowComments(["# aaa", "# ", "# bbb"], "#", 80);
      assert.deepStrictEqual(normalized[0].newLines, ["# aaa", "#", "# bbb"]);
    });

    test("Code lines delimit comment runs and are untouched", function () {
      const reflows = reflowComments(
        ["# aaa bbb ccc", "x <- 1  # trailing comment stays put", "# ddd eee fff"],
        "#",
        10
      );
      assert.strictEqual(reflows.length, 2);
      assert.deepStrictEqual(reflows[0], {
        startLine: 0,
        endLine: 0,
        newLines: ["# aaa bbb", "# ccc"],
      });
      assert.deepStrictEqual(reflows[1], {
        startLine: 2,
        endLine: 2,
        newLines: ["# ddd eee", "# fff"],
      });
    });

    test("Keeps dividers, banners, and section headers verbatim", function () {
      const reflows = reflowComments(
        [
          "# ---------------------------------------",
          "# aaa bbb ccc",
          "###########################################",
          "# Load the data ----",
        ],
        "#",
        10
      );
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0].newLines, [
        "# ---------------------------------------",
        "# aaa bbb",
        "# ccc",
        "###########################################",
        "# Load the data ----",
      ]);
    });

    test("Preserves indentation and extended prefixes", function () {
      const reflows = reflowComments(
        ["  # aaa bbb ccc", "#' roxygen docs stay grouped apart", "#' from plain comments"],
        "#",
        12
      );
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0].newLines, [
        "  # aaa bbb",
        "  # ccc",
        "#' roxygen",
        "#' docs stay",
        "#' grouped",
        "#' apart",
        "#' from",
        "#' plain",
        "#' comments",
      ]);
    });

    test("Supports multi-character comment strings", function () {
      const reflows = reflowComments(["-- aaa bbb ccc", "select 1"], "--", 12);
      assert.strictEqual(reflows.length, 1);
      assert.deepStrictEqual(reflows[0].newLines, ["-- aaa bbb", "-- ccc"]);
    });
  });

  suite("quarto.reflowCommentInCell command", function () {
    suiteSetup(async function () {
      await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
      await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
    });

    teardown(async function () {
      // Revert any document mutation so tests stay independent
      await vscode.commands.executeCommand("undo");
    });

    test("Reflows the comments in the R cell at the cursor", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("reflow.qmd");

      // Line 7: the long comment in the R cell
      editor.selection = new vscode.Selection(7, 0, 7, 0);
      await vscode.commands.executeCommand("quarto.reflowCommentInCell");

      const cell = doc.getText().split("\n").slice(6, 14).join("\n");
      assert.strictEqual(
        cell,
        [
          "```{r}",
          "# It is a truth universally acknowledged, that a single man in possession of a",
          "# good fortune must be in want of a wife.",
          "#",
          '# "My dear Mr. Bennet," said his lady to him one day, "have you heard that',
          "# Netherfield Park is let at last?\"",
          "",
          "1 + 1",
        ].join("\n")
      );
    });

    test("Leaves option directives and code untouched in the Python cell", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("reflow.qmd");

      // Line 16: the long comment in the python cell
      editor.selection = new vscode.Selection(16, 0, 16, 0);
      await vscode.commands.executeCommand("quarto.reflowCommentInCell");

      const lines = doc.getText().split("\n");
      assert.strictEqual(lines[15], "#| echo: false");
      assert.strictEqual(
        lines[16],
        "# However little known the feelings or views of such a man may be on his first"
      );
      assert.strictEqual(
        lines[17],
        "# entering a neighbourhood, this truth is so well fixed in the minds of the"
      );
      assert.strictEqual(lines[18], "# surrounding families.");
      assert.strictEqual(lines[19], "x = 1");
    });

    test("Shows info message when cursor is on a markdown line", async function () {
      const { doc, editor } = await openAndShowExamplesOutTextDocument("reflow.qmd");
      const before = doc.getText();

      const original = vscode.window.showInformationMessage;
      const messages: string[] = [];
      vscode.window.showInformationMessage = async (msg: string) => {
        messages.push(msg);
        return undefined as any;
      };

      try {
        // Line 4: "## Comments"
        editor.selection = new vscode.Selection(4, 0, 4, 0);
        await vscode.commands.executeCommand("quarto.reflowCommentInCell");

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0], "Editor selection is not within a code cell.");
        assert.strictEqual(doc.getText(), before);
      } finally {
        vscode.window.showInformationMessage = original;
      }
    });
  });
});
