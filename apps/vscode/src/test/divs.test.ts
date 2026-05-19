import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri, openAndShowExamplesOutTextDocument } from "./test-utils";
import { MarkdownEngine } from "../markdown/engine";
import { getDivDepths, getDivMarkerRange } from "../providers/div-brackets";

suite("Div detection", function () {
  const engine = new MarkdownEngine();

  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  test("Detects div tokens in simple document", async function () {
    const { doc } = await openAndShowExamplesOutTextDocument("simple-divs.qmd");

    const tokens = engine.parse(doc);
    const divTokens = tokens.filter(t => t.type === "Div");

    assert.strictEqual(
      divTokens.length,
      3,
      `Expected 3 div tokens (callout + columns + nested column), found ${divTokens.length}`
    );
  });

  test("Detects many div tokens", async function () {
    const { doc } = await openAndShowExamplesOutTextDocument("div-code-blocks.qmd");

    const tokens = engine.parse(doc);
    const divTokens = tokens.filter(t => t.type === "Div");

    // The file has many .notes divs
    assert.ok(
      divTokens.length > 10,
      `Expected more than 10 div tokens, found ${divTokens.length}`
    );
  });

  test("getDivDepths calculates nesting correctly", async function () {
    const { doc } = await openAndShowExamplesOutTextDocument("simple-divs.qmd");

    const tokens = engine.parse(doc);
    const divTokens = tokens.filter(t => t.type === "Div");
    const depths = getDivDepths(divTokens);

    // First div (callout) should be at depth 0
    assert.strictEqual(depths.get(divTokens[0]), 0);
    // Second div (columns) should be at depth 0
    assert.strictEqual(depths.get(divTokens[1]), 0);
    // Third div (nested column) should be at depth 1
    assert.strictEqual(depths.get(divTokens[2]), 1);
  });

  test("getDivMarkerRange extracts ::: range", async function () {
    const { editor } = await openAndShowExamplesOutTextDocument("simple-divs.qmd");

    // Line 4 has ":::"
    const range = getDivMarkerRange(editor, 4);
    assert.ok(range, "Expected a range to be found");
    assert.strictEqual(range!.start.line, 4);
    assert.strictEqual(range!.start.character, 0);
    assert.strictEqual(range!.end.character, 3);
  });
});
