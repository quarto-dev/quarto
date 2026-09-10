import * as vscode from "vscode";
import * as assert from "assert";
import { openAndShowUniqueExamplesDocument, wait } from "./test-utils";
import { DisposableStore } from "core";
import { hasChunkSymbols, nestCellSymbols, QuartoCellSymbols } from "../lsp/cell-symbols";

/**
 * Creates a fake document symbol provider that returns DocumentSymbol[] for virtual docs.
 */
function createFakeDocumentSymbolProvider(
  symbols: vscode.DocumentSymbol[]
): vscode.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(
      document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
      return symbols;
    },
  };
}

/**
 * Creates a fake document symbol provider that returns SymbolInformation[] for virtual docs.
 */
function createFakeSymbolInformationProvider(
  symbolNames: string[]
): vscode.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(
      document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.SymbolInformation[]> {
      return symbolNames.map((name, index) =>
        new vscode.SymbolInformation(
          name,
          vscode.SymbolKind.Function,
          "",
          new vscode.Location(
            document.uri,
            new vscode.Range(index, 0, index, 10)
          )
        )
      );
    },
  };
}

/**
 * Creates a fake document symbol provider that returns undefined.
 */
function createUndefinedSymbolProvider(): vscode.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(): vscode.ProviderResult<vscode.DocumentSymbol[] | vscode.SymbolInformation[]> {
      return undefined;
    },
  };
}

/**
 * Recursively flattens symbol names from a DocumentSymbol tree.
 */
function flattenSymbolNames(symbols: vscode.DocumentSymbol[]): string[] {
  const result: string[] = [];
  const walk = (syms: vscode.DocumentSymbol[]) => {
    for (const sym of syms) {
      result.push(sym.name);
      if (sym.children?.length) walk(sym.children);
    }
  };
  walk(symbols);
  return result;
}

suite("Code Cell Symbols", function () {
  const disposables = new DisposableStore();

  setup(async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", true);
    await wait(500);
  });

  teardown(async function () {
    disposables.clear();
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", undefined);
  });

  test("handles DocumentSymbol[] from embedded provider", async function () {
    const fakeSymbols = [
      new vscode.DocumentSymbol(
        "my_function",
        "",
        vscode.SymbolKind.Function,
        new vscode.Range(0, 0, 5, 0),
        new vscode.Range(0, 0, 5, 0)
      ),
      new vscode.DocumentSymbol(
        "my_variable",
        "",
        vscode.SymbolKind.Variable,
        new vscode.Range(6, 0, 6, 10),
        new vscode.Range(6, 0, 6, 10)
      ),
    ];

    // Register BEFORE opening the document
    // Use both scheme and language like the formatting tests
    disposables.add(vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createFakeDocumentSymbolProvider(fakeSymbols)
    ));
    await wait(100);

    const { doc } = await openAndShowUniqueExamplesDocument("format/basics.qmd", disposables);
    await wait(800);

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri
    );

    const names = flattenSymbolNames(symbols);
    assert.ok(
      names.includes("my_function"),
      `Expected 'my_function' in symbols, got: ${names.join(", ")}`
    );
    assert.ok(
      names.includes("my_variable"),
      `Expected 'my_variable' in symbols, got: ${names.join(", ")}`
    );
    assert.ok(
      names.includes("(code cell)"),
      `Expected '(code cell)' in symbols, got: ${names.join(", ")}`
    );
  });

  test("handles SymbolInformation[] from embedded provider", async function () {
    const symbolNames = ["info_function", "info_class"];

    // Register BEFORE opening the document
    disposables.add(vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createFakeSymbolInformationProvider(symbolNames)
    ));
    await wait(100);

    const { doc } = await openAndShowUniqueExamplesDocument("format/basics.qmd", disposables);
    await wait(800);

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri
    );

    const names = flattenSymbolNames(symbols);
    assert.ok(
      names.includes("(code cell)"),
      `Expected '(code cell)' in symbols, got: ${names.join(", ")}`
    );
    assert.ok(
      names.includes("info_function"),
      `Expected 'info_function' in symbols, got: ${names.join(", ")}`
    );
    assert.ok(
      names.includes("info_class"),
      `Expected 'info_class' in symbols, got: ${names.join(", ")}`
    );
  });

  test("handles undefined from embedded provider without error", async function () {
    // Register BEFORE opening the document
    disposables.add(vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createUndefinedSymbolProvider()
    ));
    await wait(100);

    const { doc } = await openAndShowUniqueExamplesDocument("format/basics.qmd", disposables);
    await wait(800);

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri
    );

    const names = flattenSymbolNames(symbols);
    assert.ok(
      names.includes("(code cell)"),
      `Expected '(code cell)' to still appear even when embedded provider returns undefined, got: ${names.join(", ")}`
    );
  });
});

/**
 * Builds a chunk symbol the way the Quarto language server's `toc.ts` does:
 * `SymbolKind.Function`, over a range that covers the fences too.
 */
function chunkSymbol(
  name: string,
  startLine: number,
  endLine: number
): vscode.DocumentSymbol {
  return new vscode.DocumentSymbol(
    name,
    "",
    vscode.SymbolKind.Function,
    new vscode.Range(startLine, 0, endLine, 3),
    new vscode.Range(startLine, 0, startLine, 3)
  );
}

function headingSymbol(
  name: string,
  startLine: number,
  endLine: number,
  children: vscode.DocumentSymbol[]
): vscode.DocumentSymbol {
  const symbol = new vscode.DocumentSymbol(
    name,
    "",
    vscode.SymbolKind.String,
    new vscode.Range(startLine, 0, endLine, 0),
    new vscode.Range(startLine, 0, startLine, 0)
  );
  symbol.children = children;
  return symbol;
}

/** One cell's answer from `positron.executeQuartoCellSymbolProvider`. */
function cellAnswer(
  startLine: number,
  endLine: number,
  names: string[]
): QuartoCellSymbols {
  return {
    range: new vscode.Range(startLine, 0, endLine, 0),
    symbols: names.map(
      (name) =>
        new vscode.DocumentSymbol(
          name,
          "",
          vscode.SymbolKind.Variable,
          new vscode.Range(startLine, 0, startLine, 5),
          new vscode.Range(startLine, 0, startLine, 5)
        )
    ),
  };
}

suite("Host Cell Symbol Nesting", function () {
  test("nests a cell's symbols under the chunk that contains it", function () {
    // Chunk fences on lines 2 and 5, so the cell's code span is lines 3 to 4.
    const symbols = [chunkSymbol("{r}", 2, 5)];
    const cells = [cellAnswer(3, 4, ["my_function"])];

    const nested = nestCellSymbols(symbols, cells);

    assert.deepStrictEqual(flattenSymbolNames(nested), ["{r}", "my_function"]);
  });

  test("leaves a chunk alone when no cell's code sits inside it", function () {
    const symbols = [chunkSymbol("{r}", 2, 5)];
    // A cell from a different chunk further down the document.
    const cells = [cellAnswer(11, 12, ["other_function"])];

    const nested = nestCellSymbols(symbols, cells);

    assert.deepStrictEqual(flattenSymbolNames(nested), ["{r}"]);
  });

  test("gives each chunk only its own cell's symbols", function () {
    const symbols = [chunkSymbol("{r}", 2, 5), chunkSymbol("{python}", 7, 10)];
    const cells = [
      cellAnswer(3, 4, ["r_thing"]),
      cellAnswer(8, 9, ["python_thing"]),
    ];

    const nested = nestCellSymbols(symbols, cells);

    assert.deepStrictEqual(flattenSymbolNames(nested), [
      "{r}",
      "r_thing",
      "{python}",
      "python_thing",
    ]);
  });

  test("finds chunks nested under headings", function () {
    const symbols = [
      headingSymbol("Section", 0, 11, [
        chunkSymbol("{r}", 2, 5),
        headingSymbol("Subsection", 6, 11, [chunkSymbol("{python}", 7, 10)]),
      ]),
    ];
    const cells = [
      cellAnswer(3, 4, ["r_thing"]),
      cellAnswer(8, 9, ["python_thing"]),
    ];

    const nested = nestCellSymbols(symbols, cells);

    assert.deepStrictEqual(flattenSymbolNames(nested), [
      "Section",
      "{r}",
      "r_thing",
      "Subsection",
      "{python}",
      "python_thing",
    ]);
  });

  test("keeps children the language server already nested under a chunk", function () {
    const chunk = chunkSymbol("{r}", 2, 5);
    chunk.children = [
      new vscode.DocumentSymbol(
        "existing",
        "",
        vscode.SymbolKind.Field,
        new vscode.Range(3, 0, 3, 4),
        new vscode.Range(3, 0, 3, 4)
      ),
    ];
    const cells = [cellAnswer(3, 4, ["my_function"])];

    const nested = nestCellSymbols([chunk], cells);

    assert.deepStrictEqual(flattenSymbolNames(nested), [
      "{r}",
      "existing",
      "my_function",
    ]);
  });

  test("returns the tree unchanged when no cell has symbols", function () {
    const symbols = [
      headingSymbol("Section", 0, 6, [chunkSymbol("{r}", 2, 5)]),
    ];

    const nested = nestCellSymbols(symbols, []);

    assert.deepStrictEqual(flattenSymbolNames(nested), ["Section", "{r}"]);
  });
});

suite("Chunk Symbol Detection", function () {
  test("finds a chunk at the top level", function () {
    assert.strictEqual(hasChunkSymbols([chunkSymbol("{r}", 2, 5)]), true);
  });

  test("finds a chunk nested under headings", function () {
    const symbols = [
      headingSymbol("Section", 0, 11, [
        headingSymbol("Subsection", 6, 11, [chunkSymbol("{python}", 7, 10)]),
      ]),
    ];

    assert.strictEqual(hasChunkSymbols(symbols), true);
  });

  test("finds no chunk in a tree of headings only", function () {
    // What the outline looks like while `showCodeCellsInOutline` is off: the
    // language server has filtered every chunk out of the tree.
    const symbols = [
      headingSymbol("Section", 0, 11, [
        headingSymbol("Subsection", 6, 11, []),
      ]),
    ];

    assert.strictEqual(hasChunkSymbols(symbols), false);
  });

  test("finds no chunk in an empty tree", function () {
    assert.strictEqual(hasChunkSymbols([]), false);
  });
});
