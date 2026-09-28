import * as path from "path";
import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, setExportToWorkspaceAndWait, waitForWorkspaceSymbol } from "./test-utils";

const HEADERS = ["Symbols-Header-1", "Symbols-Header-2"];

suite("Workspace Symbols", function () {
  suiteSetup(async function () {
    // The LSP now starts lazily, so wait for it to be running and have indexed
    // the workspace before asserting on symbol results.
    this.timeout(30000);
    await waitForWorkspaceSymbol("Symbols-Header-1");
  });

  teardown(async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.exportToWorkspace", "default");
  });

  // Each test first switches to a setting with the opposite result, so that
  // the final wait observes the LSP actually applying the setting under test.

  test("provides all symbols by default when not in R projects", async function () {
    await setExportToWorkspaceAndWait("none", HEADERS, false);
    await setExportToWorkspaceAndWait("default", HEADERS, true);
  });

  test("provides all symbols when set to 'all'", async function () {
    await setExportToWorkspaceAndWait("none", HEADERS, false);
    await setExportToWorkspaceAndWait("all", HEADERS, true);
  });

  test("provides no symbols when set to 'none'", async function () {
    await setExportToWorkspaceAndWait("all", HEADERS, true);
    await setExportToWorkspaceAndWait("none", HEADERS, false);
  });
});

suite("Document Symbols", function () {
  const basicsUri = vscode.Uri.file(path.join(WORKSPACE_PATH, "format", "basics.qmd"));

  teardown(async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", undefined);
  });

  test("includes code cells when showCodeCellsInOutline is true", async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", true);

    // give the LSP time to re-register its symbol provider after the config change
    await new Promise(r => setTimeout(r, 500));

    await vscode.workspace.openTextDocument(basicsUri);
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      basicsUri
    );

    const names = flattenSymbolNames(symbols);
    assert.ok(
      names.includes("(code cell)"),
      `expected a code cell in symbols, got: ${names.join(", ")}`
    );
  });

  test("excludes code cells when showCodeCellsInOutline is false", async function () {
    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", false);

    await new Promise(r => setTimeout(r, 500));

    await vscode.workspace.openTextDocument(basicsUri);
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      basicsUri
    );

    const names = flattenSymbolNames(symbols);
    assert.ok(
      !names.includes("(code cell)"),
      `expected no code cells in symbols, got: ${names.join(", ")}`
    );
  });

  test("toggling showCodeCellsInOutline live updates symbols", async function () {
    await vscode.workspace.openTextDocument(basicsUri);

    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", true);
    await new Promise(r => setTimeout(r, 500));

    let symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      basicsUri
    );
    assert.ok(
      flattenSymbolNames(symbols).includes("(code cell)"),
      "expected code cells to appear after setting true"
    );

    await vscode.workspace
      .getConfiguration("quarto")
      .update("symbols.showCodeCellsInOutline", false);
    await new Promise(r => setTimeout(r, 500));

    symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      basicsUri
    );
    assert.ok(
      !flattenSymbolNames(symbols).includes("(code cell)"),
      "expected code cells to disappear after setting false"
    );
  });
});

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
