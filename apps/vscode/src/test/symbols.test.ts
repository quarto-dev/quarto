import * as vscode from "vscode";
import * as assert from "assert";

suite("Workspace Symbols", function () {
  teardown(async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.exportToWorkspace", "default");
  });

  test("provides all symbols by default when not in R projects", async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.exportToWorkspace", "default");

    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      "vscode.executeWorkspaceSymbolProvider",
      ""
    );

    // All symbols are provided
    assert.ok(symbols.find((s) => s.name === "Symbols-Header-1"));
    assert.ok(symbols.find((s) => s.name === "Symbols-Header-2"));
  });

  test("provides all symbols when set to 'all'", async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.exportToWorkspace", "all");

    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      "vscode.executeWorkspaceSymbolProvider",
      ""
    );

    // All symbols are provided
    assert.ok(symbols.find((s) => s.name === "Symbols-Header-1"));
    assert.ok(symbols.find((s) => s.name === "Symbols-Header-2"));
  });

  test("provides no symbols when set to 'none'", async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.exportToWorkspace", "none");

    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      "vscode.executeWorkspaceSymbolProvider",
      ""
    );

    // No symbols are provided
    assert.ok(!symbols.find((s) => s.name === "Regular-Project Header 1"));
    assert.ok(!symbols.find((s) => s.name === "Regular-Project Header 2"));
  });
});
