import * as assert from "assert";
import * as vscode from "vscode";
import { extension } from "./extension";
import { QuartoExtensionApi } from "../api";

suite("Visual Editor Commands", function () {
  test("quarto.editor.getSelectedText returns '' when no visual editor is active", async function () {
    const ext = extension();

    if (!ext.isActive) {
      await ext.activate();
    }

    // the command is only registered when Quarto is available
    const api = ext.exports as QuartoExtensionApi;
    if (!api.isQuartoAvailable()) {
      this.skip();
    }

    // no visual editor is open/focused, so the command should report an empty selection
    const selected = await vscode.commands.executeCommand<string>("quarto.editor.getSelectedText");
    assert.strictEqual(selected, "", "getSelectedText should return '' when no visual editor is active");
  });
});
