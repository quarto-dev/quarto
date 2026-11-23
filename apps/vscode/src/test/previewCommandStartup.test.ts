/*
 * previewCommandStartup.test.ts
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { extension } from "./extension";

suite("Preview command startup", function () {
  for (const proxy of ["http://localhost:8080/proxy/{{port}}/", undefined]) {
    test(proxy ? "preserves the inherited code-server proxy environment" : "keeps normal startup without a proxy environment", async function () {
      this.timeout(15000);
      await extension().activate();
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-preview-startup-"));
      const documentPath = path.join(directory, "dashboard.qmd");
      fs.writeFileSync(documentPath, "---\ntitle: Preview startup\nformat: html\n---\n\n# Preview\n");
      const render = vscode.workspace.getConfiguration("quarto.render");
      const originalPreviewType = render.inspect("previewType")?.workspaceValue;
      const originalProxy = process.env.VSCODE_PROXY_URI;
      const originalCreateTerminal = vscode.window.createTerminal;
      const originalWithProgress = vscode.window.withProgress;
      let terminal: vscode.Terminal | undefined;
      let options: vscode.TerminalOptions | undefined;
      let command: string | undefined;

      try {
        if (proxy === undefined) {
          delete process.env.VSCODE_PROXY_URI;
        } else {
          process.env.VSCODE_PROXY_URI = proxy;
        }
        await render.update("previewType", "internal", vscode.ConfigurationTarget.Workspace);
        // Exercise the registered preview command and its real manager. Keep a
        // real terminal for normal disposal, but capture sendText so this test
        // neither starts a server nor depends on CLI output or port forwarding.
        vscode.window.createTerminal = ((value: vscode.TerminalOptions) => {
          options = value;
          terminal = originalCreateTerminal(value);
          terminal.sendText = (text: string) => { command = text; };
          return terminal;
        }) as typeof vscode.window.createTerminal;
        // No render is launched, so there is no progress result to wait for.
        vscode.window.withProgress = (async () => undefined) as typeof vscode.window.withProgress;
        const document = await vscode.workspace.openTextDocument(documentPath);
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("quarto.preview");

        assert.ok(options, "Preview should create a terminal");
        // An explicit null removes an inherited variable from a VS Code
        // terminal. That is the regression even if all render/bridge tests pass.
        assert.strictEqual(options!.env?.["VSCODE_PROXY_URI"], undefined);
        assert.strictEqual(process.env.VSCODE_PROXY_URI, proxy);
        assert.ok(command?.includes("--metadata-file"), "The command-link bridge must remain enabled");
        assert.ok(command?.includes("dashboard.qmd"));
      } finally {
        vscode.window.createTerminal = originalCreateTerminal;
        vscode.window.withProgress = originalWithProgress;
        if (originalProxy === undefined) {
          delete process.env.VSCODE_PROXY_URI;
        } else {
          process.env.VSCODE_PROXY_URI = originalProxy;
        }
        // Closing the real terminal also lets the preview manager revoke its
        // command session and remove the temporary bridge files.
        terminal?.dispose();
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        await render.update("previewType", originalPreviewType, vscode.ConfigurationTarget.Workspace);
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
