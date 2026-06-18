import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri, openAndShowExamplesOutTextDocument } from "./test-utils";
import { isExecutableLanguageBlock, languageNameFromBlock } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";

suite("Code block detection", function () {
  const engine = new MarkdownEngine();

  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  // Test for issue #521 / PR #875:
  // Code blocks inside divs should be detected even when the closing :::
  // doesn't have a preceding blank line. This real-world example has many
  // .notes divs which caused later code blocks to not be detected.
  test("Detects code blocks in document with many divs (issue #521)", async function () {
    const { doc } = await openAndShowExamplesOutTextDocument("div-code-blocks.qmd");

    const tokens = engine.parse(doc);
    const executableBlocks = tokens.filter(isExecutableLanguageBlock);

    // Count R code blocks and math blocks separately
    const rBlocks = executableBlocks.filter(b => languageNameFromBlock(b) === "r");
    const mathBlocks = executableBlocks.filter(b => languageNameFromBlock(b) === "tex");

    // Should find all 3 R code blocks
    assert.strictEqual(
      rBlocks.length,
      3,
      `Expected 3 R code blocks, found ${rBlocks.length}`
    );

    // Should find all 3 math blocks (displayed as tex)
    assert.strictEqual(
      mathBlocks.length,
      3,
      `Expected 3 math blocks, found ${mathBlocks.length}`
    );

    // Total should be 6 executable blocks (3 R + 3 math)
    assert.strictEqual(
      executableBlocks.length,
      6,
      `Expected 6 executable blocks total, found ${executableBlocks.length}`
    );
  });

  test("Detects code block in simple document", async function () {
    const { doc } = await openAndShowExamplesOutTextDocument("hello.qmd");

    const tokens = engine.parse(doc);
    const executableBlocks = tokens.filter(isExecutableLanguageBlock);

    assert.strictEqual(
      executableBlocks.length,
      1,
      `Expected 1 executable block in hello.qmd, found ${executableBlocks.length}`
    );

    const language = languageNameFromBlock(executableBlocks[0]);
    assert.strictEqual(language, "python", `Expected python, got ${language}`);
  });
});
