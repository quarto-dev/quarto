import * as vscode from "vscode";
import { setExportToWorkspaceAndWait, waitForWorkspaceSymbol } from "./test-utils";

// This file is for testing behaviour that is specific to R projects, i.e.
// projects with a top-level `DESCRIPTION` file.

const HEADERS = ["Symbols-Header-1", "Symbols-Header-2"];

suite("Workspace Symbols - R Project", function () {
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

  test("does not provide symbols by default in R projects", async function () {
    await setExportToWorkspaceAndWait("all", HEADERS, true);
    await setExportToWorkspaceAndWait("default", HEADERS, false);
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
