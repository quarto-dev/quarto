import * as vscode from "vscode";
import * as assert from "assert";

import { isExecutableLanguageBlock, TokenCodeBlock, TokenMath } from "quarto-core";
import { MarkdownEngine } from "../markdown/engine";
import { codeWithoutOptionsFromBlock } from "../providers/cell/executors";
import { cellOptions } from "../providers/cell/options";
import { rcppWithSourceCpp } from "../host/executors";

suite("Code sent for execution", function () {
  const engine = new MarkdownEngine();

  /**
   * Parses `content` as an in-memory Quarto document and returns the code of
   * its single executable cell, as it would be sent to an executor (without
   * the trailing newline, which isn't what's under test here).
   */
  async function executedCode(content: string): Promise<string> {
    const doc = await vscode.workspace.openTextDocument({
      language: "quarto",
      content,
    });
    const blocks = engine.parse(doc).filter(isExecutableLanguageBlock);
    assert.strictEqual(blocks.length, 1, "expected exactly one executable cell");
    return codeWithoutOptionsFromBlock(blocks[0] as TokenMath | TokenCodeBlock).trimEnd();
  }

  test("strips #| options from a Python cell", async function () {
    assert.strictEqual(
      await executedCode("```{python}\n#| label: a\n#| echo: false\nx = 1\n```"),
      "x = 1"
    );
  });

  test("strips #| options from a bash cell", async function () {
    assert.strictEqual(
      await executedCode("```{bash}\n#| label: a\necho hi\n```"),
      "echo hi"
    );
  });

  test("keeps #| lines in a language whose options use other comment characters", async function () {
    // stata has an executor, but its cell options are written as `*|`; a `#|`
    // line is code, not an option, so it is sent as is
    assert.strictEqual(
      await executedCode("```{stata}\n#| label: a\ndisplay 1\n```"),
      "#| label: a\ndisplay 1"
    );
  });
});

suite("Rcpp cells", function () {
  test("are compiled with Rcpp::sourceCpp() in R", function () {
    assert.strictEqual(
      rcppWithSourceCpp("// [[Rcpp::export]]\nint one() { return 1; }"),
      'Rcpp::sourceCpp(code = r"--(// [[Rcpp::export]]\nint one() { return 1; })--")'
    );
  });

  test("use a raw string delimiter that doesn't occur in the code", function () {
    // a C++ raw string with the same delimiter as the R raw string
    const code = 'std::string s = R"--(a)--";\nstd::string t = R"---(b)---";';
    assert.strictEqual(
      rcppWithSourceCpp(code),
      `Rcpp::sourceCpp(code = r"----(${code})----")`
    );
  });

  test("read //| option lines, as knitr does", function () {
    assert.deepStrictEqual(
      cellOptions("Rcpp", ["//| eval: false", "int x;"]),
      { eval: false }
    );
  });
});
