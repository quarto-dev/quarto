import * as vscode from "vscode";
import * as assert from "assert";
import { openAndShowExamplesTextDocument, wait } from "./test-utils";
import { embeddedDocumentFormattingProvider } from "../providers/format";
import { MarkdownEngine } from "../markdown/engine";

/**
 * Creates a document formatting provider from a formatting function.
 * @param format - Function that transforms source text
 * @returns Document formatting edit provider
 */
function createFormatterFromStringFunc(
  format: (sourceText: string) => string
): vscode.DocumentFormattingEditProvider {
  return {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument
    ): vscode.TextEdit[] {
      const text = document.getText();
      const formatted = format(text);
      return [
        new vscode.TextEdit(
          new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
          ),
          formatted
        ),
      ];
    },
  };
}

/**
 * Creates a document formatting provider that returns one `TextEdit` per
 * non-empty line, instead of a single block-wide edit. This stresses the
 * per-block loop with multiple discrete edits per cell so that any future
 * regression in edit aggregation, sorting, or offset adjustment is caught.
 */
function createPerLineFormatter(
  format: (line: string) => string
): vscode.DocumentFormattingEditProvider {
  return {
    provideDocumentFormattingEdits(
      document: vscode.TextDocument
    ): vscode.TextEdit[] {
      const edits: vscode.TextEdit[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        if (lineText.length === 0) {
          continue;
        }
        const replaced = format(lineText);
        if (replaced !== lineText) {
          edits.push(
            new vscode.TextEdit(
              new vscode.Range(
                new vscode.Position(i, 0),
                new vscode.Position(i, lineText.length)
              ),
              replaced
            )
          );
        }
      }
      return edits;
    },
  };
}

/**
 * Sets the cursor position in the active editor.
 * @param line - Line number
 * @param character - Character position
 */
function setCursorPosition(line: number, character: number): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const position = new vscode.Position(line, character);
    editor.selection = new vscode.Selection(position, position);
  }
}

/**
 * Tests formatter on a file at a given cursor position.
 * @param filename - Name of test file
 * @param position - Tuple of line and character position
 * @param format - Formatting function
 * @param language - Language identifier to register the formatter for
 * @returns Formatted document text
 */
async function testFormatter(
  filename: string,
  [line, character]: [number, number],
  format: (sourceText: string) => string,
  language: string = "python"
) {
  const { doc } = await openAndShowExamplesTextDocument(filename);

  const formattingEditProvider =
    vscode.languages.registerDocumentFormattingEditProvider(
      { scheme: "file", language },
      createFormatterFromStringFunc(format)
    );

  try {
    setCursorPosition(line, character);
    await wait(450);
    await vscode.commands.executeCommand("quarto.formatCell");
    await wait(450);

    const result = doc.getText();
    return result;
  } finally {
    formattingEditProvider.dispose();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }
}

/**
 * Inserts spaces around `=` and `+`, and splits `;`-separated statements
 * so fake formatter output is deterministic and visibly different from
 * the input.
 */
function spaceAssignments(sourceText: string): string {
  return spaceBinaryOperators(sourceText.replace(/;/g, "\n"));
}

/**
 * Hostile formatter that would rewrite option directives and mangle
 * assignments if it were ever allowed to see them. Used to prove that
 * option lines never reach the formatter.
 */
function hostileFormatter(sourceText: string): string {
  return spaceBinaryOperators(sourceText.replace(/#\| /g, "# PIPE "));
}

/**
 * Reformats assignments and adds a space after the `#` of standalone
 * comments. Exists so that tests with multiline, comment-containing code
 * cells can prove both the code and the comments are touched by the
 * formatter, while the option directives are not.
 */
function formatCodeAndComments(sourceText: string): string {
  return spaceBinaryOperators(sourceText).replace(/^#(\S)/gm, "# $1");
}

function spaceBinaryOperators(src: string): string {
  return src
    .replace(/(\w)=(\w)/g, "$1 = $2")
    .replace(/(\w)\+(\w)/g, "$1 + $2");
}

/**
 * Aggressive formatter that rewrites any line that looks remotely like a
 * Quarto option directive, regardless of whitespace around the pipe. If the
 * strip-before-format path is working, the formatter never sees a directive
 * line, so `# MANGLED` must not appear in the final result.
 */
function mangleHashPipeLines(sourceText: string): string {
  return spaceBinaryOperators(
    sourceText.replace(/^#\s*\|.*$/gm, "# MANGLED")
  );
}

/**
 * Hostile R formatter that rewrites `#|` directives and normalises the
 * assignment arrow.
 */
function hostileRFormatter(sourceText: string): string {
  return sourceText
    .replace(/#\s*\|.*$/gm, "# PIPE MANGLED")
    .replace(/(\w)<-(\w)/g, "$1 <- $2");
}

/**
 * Hostile TypeScript formatter that rewrites `//|` directives and
 * normalises `=`.
 */
function hostileTypeScriptFormatter(sourceText: string): string {
  return spaceBinaryOperators(
    sourceText.replace(/^\/\/\s*\|.*$/gm, "// PIPE MANGLED")
  );
}

suite("Code Block Formatting", function () {
  test("single option directive is preserved while code is formatted", async function () {
    const formattedResult = await testFormatter(
      "format-python.qmd",
      [8, 0],
      spaceAssignments
    );

    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("y = 2"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("#| label: my-code"),
      "Option directive should be preserved"
    );
    assert.ok(
      !formattedResult.includes("x=1;y=2;z=x+y"),
      "Original unformatted source should be gone"
    );
  });

  test("multiple option directives are all preserved in order", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiple-options.qmd",
      [10, 0],
      spaceAssignments
    );

    const labelIndex = formattedResult.indexOf("#| label: multi");
    const echoIndex = formattedResult.indexOf("#| echo: false");
    const warningIndex = formattedResult.indexOf("#| warning: false");
    assert.ok(labelIndex >= 0, "`#| label: multi` should be preserved");
    assert.ok(echoIndex >= 0, "`#| echo: false` should be preserved");
    assert.ok(warningIndex >= 0, "`#| warning: false` should be preserved");
    assert.ok(
      labelIndex < echoIndex && echoIndex < warningIndex,
      "Option directives should keep their original order"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      !formattedResult.includes("x=1;y=2;z=x+y"),
      "Original unformatted source should be gone"
    );
  });

  test("blocks without option directives are formatted normally", async function () {
    const formattedResult = await testFormatter(
      "format-python-no-options.qmd",
      [7, 0],
      spaceAssignments
    );

    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Code should be reformatted with spaces around `=`"
    );
    assert.ok(
      !formattedResult.includes("#|"),
      "No option directives should be introduced"
    );
  });

  test("blocks containing only option directives are left untouched", async function () {
    const formattedResult = await testFormatter(
      "format-python-only-options.qmd",
      [7, 0],
      (src) => src.replace(/only-options/g, "REPLACED")
    );

    assert.ok(
      formattedResult.includes("#| label: only-options"),
      "Option directive should be preserved verbatim when there is no code to format"
    );
    assert.ok(
      !formattedResult.includes("REPLACED"),
      "Hostile formatter must not reach option-only blocks"
    );
  });

  test("multiline code with badly formatted comments is reformatted while options stay intact", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiline-with-comments.qmd",
      [10, 0],
      formatCodeAndComments
    );

    assert.ok(
      formattedResult.includes("#| label: multiline"),
      "`#| label: multiline` should be preserved exactly"
    );
    assert.ok(
      formattedResult.includes("#| echo: false"),
      "`#| echo: false` should be preserved exactly"
    );
    assert.ok(
      !formattedResult.includes("# | label"),
      "The hashpipe must not be rewritten by the comment-normalising regex"
    );
    assert.ok(
      formattedResult.includes("# standalone comment"),
      "Standalone code comment should be reformatted with a leading space"
    );
    assert.ok(
      !/^#standalone comment$/m.test(formattedResult),
      "Original unformatted standalone comment should be gone"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "First assignment should be reformatted"
    );
    assert.ok(
      formattedResult.includes("y = 2"),
      "Second assignment should be reformatted"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Third assignment should be reformatted"
    );
  });

  test("option directives are hidden from hostile formatters", async function () {
    const formattedResult = await testFormatter(
      "format-python-multiple-options.qmd",
      [10, 0],
      hostileFormatter
    );

    assert.ok(
      formattedResult.includes("#| label: multi"),
      "`#| label: multi` must not be rewritten"
    );
    assert.ok(
      formattedResult.includes("#| echo: false"),
      "`#| echo: false` must not be rewritten"
    );
    assert.ok(
      formattedResult.includes("#| warning: false"),
      "`#| warning: false` must not be rewritten"
    );
    assert.ok(
      !formattedResult.includes("# PIPE "),
      "Hostile rewrite of the hashpipe must not appear anywhere"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should still be reformatted by the hostile formatter"
    );
  });

  test("option directives with non-canonical whitespace are still protected", async function () {
    const formattedResult = await testFormatter(
      "format-python-option-variants.qmd",
      [10, 0],
      mangleHashPipeLines
    );

    // All three whitespace variants must survive byte-identical, since
    // Quarto's own option parser accepts `^#\s*\| ?`.
    assert.ok(
      formattedResult.includes("#|label: no-space"),
      "`#|label: no-space` must be preserved verbatim"
    );
    assert.ok(
      formattedResult.includes("# | space-before-pipe"),
      "`# | space-before-pipe` must be preserved verbatim"
    );
    assert.ok(
      formattedResult.includes("#|  extra-space-after"),
      "`#|  extra-space-after` must be preserved verbatim"
    );
    assert.ok(
      !formattedResult.includes("# MANGLED"),
      "Aggressive formatter must not have touched any option line"
    );
    assert.ok(
      formattedResult.includes("x = 1"),
      "Code should still be reformatted"
    );
    assert.ok(
      formattedResult.includes("z = x + y"),
      "Binary operators in code should still be spaced"
    );
  });

  test("typescript option directives are protected via language.comment", async function () {
    const formattedResult = await testFormatter(
      "format-typescript.qmd",
      [9, 0],
      hostileTypeScriptFormatter,
      "typescript"
    );

    // TypeScript uses `//` for comments and `//|` for directives. Before
    // the fix this path was silently broken because the lookup used
    // `language.ids[0] === "ts"`, which wasn't in the old `kLangCommentChars`
    // map. Since `language.comment` is populated from editor-core, the
    // directive is now recognised.
    assert.ok(
      formattedResult.includes("//| label: ts-cell"),
      "`//| label: ts-cell` must be preserved verbatim"
    );
    assert.ok(
      formattedResult.includes("//| echo: false"),
      "`//| echo: false` must be preserved verbatim"
    );
    assert.ok(
      !formattedResult.includes("// PIPE MANGLED"),
      "Hostile rewrite of the hashpipe must not appear anywhere"
    );
    assert.ok(
      formattedResult.includes("const x = 1;"),
      "TypeScript assignment should be reformatted"
    );
    assert.ok(
      formattedResult.includes("const z = x + y;"),
      "TypeScript binary operators should be spaced"
    );
  });

  test("document formatting protects options across every block", async function () {
    const { doc, editor } = await openAndShowExamplesTextDocument(
      "format-r-multiple-blocks.qmd"
    );

    // Register the embedded document formatter for `quarto` documents so
    // VS Code routes `vscode.executeFormatDocumentProvider` through the
    // real path the extension uses in production (validation, ordering,
    // overlap checks, transactional application). In production this is
    // wired as LSP middleware, but tests don't run the LSP — registering
    // the provider directly is the closest stand-in.
    const engine = new MarkdownEngine();
    const provider = embeddedDocumentFormattingProvider(engine);
    const quartoFormatter =
      vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file", language: "quarto" },
        {
          provideDocumentFormattingEdits: async (document, options, token) =>
            (await provider(document, options, token, async () => [])) ?? [],
        }
      );

    const innerFormatter =
      vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file", language: "r" },
        createFormatterFromStringFunc(hostileRFormatter)
      );

    try {
      // Park the cursor on a markdown line so nothing in particular is
      // selected. The document-formatting path should still visit every R
      // block.
      setCursorPosition(11, 0);

      const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        "vscode.executeFormatDocumentProvider",
        doc.uri,
        { tabSize: 2, insertSpaces: true }
      );

      assert.ok(edits, "Document-formatting provider should return edits");
      assert.ok(edits.length > 0, "Expected at least one edit");

      // Verify the edits VS Code received are pairwise non-overlapping. This
      // catches a class of regression where two block edits could collide
      // because of a wrong offset or overlapping block range.
      const sorted = edits.slice().sort((a, b) => a.range.start.compareTo(b.range.start));
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(
          sorted[i - 1].range.end.isBeforeOrEqual(sorted[i].range.start),
          `Edits ${i - 1} and ${i} overlap`
        );
      }

      await editor.edit((eb) => {
        sorted
          .slice()
          .reverse()
          .forEach((edit) => eb.replace(edit.range, edit.newText));
      });

      const result = doc.getText();

      assert.ok(
        result.includes("#| label: first"),
        "First block's option directive must be preserved"
      );
      assert.ok(
        result.includes("#| label: second"),
        "Second block's option directive must be preserved"
      );
      assert.ok(
        result.includes("#| echo: false"),
        "`#| echo: false` must be preserved"
      );
      assert.ok(
        !result.includes("# PIPE MANGLED"),
        "Hostile rewrite of the hashpipe must not appear anywhere"
      );
      assert.ok(
        result.includes("x <- 1"),
        "First block's code should be reformatted"
      );
      assert.ok(
        result.includes("y <- 2"),
        "Second block's code should be reformatted"
      );
    } finally {
      innerFormatter.dispose();
      quartoFormatter.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });

  test("formatter returning multiple discrete edits is applied correctly", async function () {
    const { doc } = await openAndShowExamplesTextDocument(
      "format-python-multiple-options.qmd"
    );

    // Per-line formatter returns one TextEdit per non-empty line. After
    // offset adjustment in `formatBlock` these must be reassembled in the
    // correct order; if the offset or sort logic regressed this test
    // would surface mis-ordered or duplicated lines.
    const innerFormatter =
      vscode.languages.registerDocumentFormattingEditProvider(
        { scheme: "file", language: "python" },
        createPerLineFormatter((line) =>
          line.replace(/(\w)=(\w)/g, "$1 = $2").replace(/(\w)\+(\w)/g, "$1 + $2")
        )
      );

    try {
      setCursorPosition(10, 0);
      await wait(450);
      await vscode.commands.executeCommand("quarto.formatCell");
      await wait(450);

      const result = doc.getText();

      assert.ok(
        result.includes("#| label: multi"),
        "Option directive should be preserved"
      );
      assert.ok(
        result.includes("#| echo: false"),
        "Option directive should be preserved"
      );
      assert.ok(
        result.includes("#| warning: false"),
        "Option directive should be preserved"
      );
      assert.ok(
        result.includes("x = 1"),
        "First assignment should be reformatted"
      );
      assert.ok(
        result.includes("y = 2"),
        "Second assignment should be reformatted"
      );
      assert.ok(
        result.includes("z = x + y"),
        "Third assignment should be reformatted"
      );
      assert.ok(
        !result.includes("x=1"),
        "Original unformatted source should be gone"
      );
    } finally {
      innerFormatter.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });

});
