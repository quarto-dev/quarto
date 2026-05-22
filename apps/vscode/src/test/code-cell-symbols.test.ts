import * as vscode from "vscode";
import * as assert from "assert";
import { openAndShowExamplesTextDocument, wait } from "./test-utils";

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
  setup(async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", true);
    await wait(500);
  });

  teardown(async function () {
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
    const provider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createFakeDocumentSymbolProvider(fakeSymbols)
    );
    await wait(100);

    try {
      const { doc } = await openAndShowExamplesTextDocument("format/basics.qmd");
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
    } finally {
      provider.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      await wait(500); // Long wait to ensure provider is fully disposed before next test
    }
  });

  // TODO: this test passes in isolation, but not when run after the previous test
  //       it seems like provider.dispose does not properly remove the previous provider
  //       because it causes `my_function`, `my_variable` to show up in this test.
  // TODO: this test, in isolation, shows duplicated code cell symbols!?
  test.skip("handles SymbolInformation[] from embedded provider", async function () {
    const symbolNames = ["info_function", "info_class"];

    // Register BEFORE opening the document
    const provider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createFakeSymbolInformationProvider(symbolNames)
    );
    await wait(500); // Wait longer for provider to fully register

    try {
      const { doc } = await openAndShowExamplesTextDocument("format/basics.qmd");
      await wait(1200); // Wait longer to ensure LSPs are ready and retry logic completes

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
    } finally {
      provider.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });

  test("handles undefined from embedded provider without error", async function () {
    // Register BEFORE opening the document
    const provider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: "file", pattern: "**/.vdoc.*" },
      createUndefinedSymbolProvider()
    );
    await wait(100);

    try {
      const { doc } = await openAndShowExamplesTextDocument("format/basics.qmd");
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
    } finally {
      provider.dispose();
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
  });
});
