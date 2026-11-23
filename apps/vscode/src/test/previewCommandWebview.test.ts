/*
 * previewCommandWebview.test.ts
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import * as path from "node:path";
import * as vscode from "vscode";
import type { HostWebviewPanel } from "../host";
import { QuartoPreviewWebview } from "../providers/preview/preview-webview";

// Substitute only the panel transport. The webview handler, VS Code settings,
// command registry and Uri constructor below are the real implementations.
class PreviewPanel implements HostWebviewPanel {
  private listener: (message: unknown) => unknown = () => undefined;
  private disposed = false;
  private readonly disposeEvent = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.disposeEvent.event;
  readonly onDidChangeViewState = new vscode.EventEmitter<unknown>().event;
  readonly visible = true;
  readonly webview = {
    html: "",
    cspSource: "https://webview.example",
    asWebviewUri: (uri: vscode.Uri) => uri,
    postMessage: async () => true,
    onDidReceiveMessage: (listener: typeof this.listener) => {
      // Retain the host handler so send() can await dispatch before assertions.
      this.listener = listener;
      return new vscode.Disposable(() => { this.listener = () => undefined; });
    },
  } as unknown as vscode.Webview;
  reveal() { }
  async send(message: unknown) { await this.listener(message); }
  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      this.disposeEvent.fire();
    }
  }
}

suite("Preview command webview", function () {
  const commandId = "quarto.test.previewCommandWebview";
  const origin = "https://editor.example";
  let panel: PreviewPanel;
  let view: QuartoPreviewWebview;
  let registration: vscode.Disposable;
  let calls: unknown[][];
  let originalPermissions: unknown;
  const configuration = () => vscode.workspace.getConfiguration("quarto.preview");
  const message = (href = `command:${commandId}`) => ({
    type: "quarto.preview.command", token: "session-one", origin, link: { href },
  });

  setup(async function () {
    this.timeout(15000);
    assert.ok(vscode.workspace.isTrusted, "Run this suite in a trusted test workspace");
    // Use and later restore only the isolated extension-host profile's User
    // value. A workspace override must not be needed to authorize this command.
    originalPermissions = configuration().inspect("allowedCommands")?.globalValue;
    await configuration().update("allowedCommands", [commandId], vscode.ConfigurationTarget.Global);
    calls = [];
    registration = vscode.commands.registerCommand(commandId, (...args: unknown[]) => { calls.push(args); });
    panel = new PreviewPanel();
    const context = {
      // Supply only the context services this webview needs to load its assets.
      extensionUri: vscode.Uri.file(path.join(__dirname, "..")),
      globalState: { update: async () => undefined },
    } as unknown as vscode.ExtensionContext;
    view = new QuartoPreviewWebview(context, {
      url: `${origin}/proxy/4321/index.html`, commandToken: "session-one",
    }, panel);
  });

  teardown(async function () {
    // Restore permissions and unregister the command to keep cases independent.
    view?.dispose();
    registration?.dispose();
    await configuration().update("allowedCommands", originalPermissions, vscode.ConfigurationTarget.Global);
  });

  test("dispatches both argument forms through the real webview handler", async function () {
    // Both routes must revive a top-level URI and retain a literal percent sign.
    const json = '[{"scheme":"file","path":"/workspace/hello.qmd"},"100%"]';
    await panel.send(message(`command:${commandId}?${encodeURIComponent(json)}`));
    await panel.send({ ...message(), link: { href: `command:${commandId}`, dataArgs: json } });
    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0][0] instanceof vscode.Uri);
    assert.strictEqual((calls[0][0] as vscode.Uri).path, "/workspace/hello.qmd");
    assert.strictEqual(calls[1][1], "100%");
  });

  test("rejects stale tokens, foreign origins and malformed payloads", async function () {
    for (const value of [
      { ...message(), token: "session-two" },
      { ...message(), origin: "https://foreign.example" },
      { ...message(), link: { href: 1 } },
      null,
    ]) {
      await panel.send(value);
    }
    assert.deepStrictEqual(calls, []);
  });

  test("rejects conflicting arguments and the old URL-only command route", async function () {
    // The legacy route lacks data-args, so allowing it would bypass conflict checks.
    await panel.send({ ...message(), link: { href: `command:${commandId}?%5B%5D`, dataArgs: "[]" } });
    await panel.send({ type: "openExternal", url: `command:${commandId}` });
    assert.deepStrictEqual(calls, []);
  });

  test("applies permission changes without recreating the preview", async function () {
    // Reuse one handler throughout; permissions must be read on each invocation.
    await configuration().update("allowedCommands", [], vscode.ConfigurationTarget.Global);
    await panel.send(message());
    assert.deepStrictEqual(calls, []);
    await configuration().update("allowedCommands", [commandId], vscode.ConfigurationTarget.Global);
    await panel.send(message());
    assert.strictEqual(calls.length, 1);
  });

  test("uses the new session when a panel is reused and revokes stopped sessions", async function () {
    // Restart the preview in the same panel, then stop it without closing it.
    view.show({ url: `${origin}/proxy/5678/index.html`, commandToken: "session-two" });
    await panel.send(message());
    assert.deepStrictEqual(calls, []);
    const current = { ...message(), token: "session-two" };
    await panel.send(current);
    assert.strictEqual(calls.length, 1);
    view.disableCommands();
    await panel.send(current);
    assert.strictEqual(calls.length, 1);
  });

  test("escapes URL entities when writing the preview settings attribute", function () {
    // Entity-looking URL text must survive embedding in an HTML attribute.
    view.show({ url: `${origin}/index.html?value=&quot;&other=<test>`, commandToken: "session-two" });
    assert.ok(panel.webview.html.includes("&amp;quot;&amp;other=&lt;test&gt;"));
  });
});
