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
  let notifications: string[];
  let openedUrls: vscode.Uri[];
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;
  let originalOpenExternal: typeof vscode.env.openExternal;
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
    // Observe user-visible errors and external navigation without opening OS
    // applications. Restore both APIs after every case, including failed ones.
    notifications = [];
    openedUrls = [];
    originalShowErrorMessage = vscode.window.showErrorMessage;
    originalOpenExternal = vscode.env.openExternal;
    vscode.window.showErrorMessage = async (text: string) => {
      notifications.push(text);
      return undefined;
    };
    vscode.env.openExternal = async (uri: vscode.Uri) => {
      openedUrls.push(uri);
      return true;
    };
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
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.env.openExternal = originalOpenExternal;
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
    // Spoofed transport messages are ignored before dispatch or notifications.
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("rejects conflicting arguments and the old URL-only command route", async function () {
    // The legacy route lacks data-args, so allowing it would bypass conflict checks.
    await panel.send({ ...message(), link: { href: `command:${commandId}?%5B%5D`, dataArgs: "[]" } });
    await panel.send({ type: "openExternal", url: `command:${commandId}` });
    await panel.send({ type: "openExternal", url: `COMMAND:${commandId}` });
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("preserves ordinary external and mail links", async function () {
    // These still use the existing external opener, irrespective of command
    // permission. An empty allowlist must not disable normal document links.
    await configuration().update("allowedCommands", [], vscode.ConfigurationTarget.Global);
    const urls = ["https://quarto.org/docs/?a=1&b=2#section", "mailto:reader@example.com"];
    for (const url of urls) {
      await panel.send({ type: "openExternal", url });
    }
    assert.deepStrictEqual(openedUrls.map(uri => uri.toString()), urls.map(url => vscode.Uri.parse(url).toString()));
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(notifications, []);
  });

  test("reports invalid arguments without exposing their contents or opening URLs", async function () {
    // Check the actual notification boundary, not just the dispatcher's result.
    // Every invalid source must fail before the command or external opener runs.
    for (const [link, expected] of [
      [{ href: "https://example.com/private-url" }, "Invalid preview command link."],
      [{ href: `command:${commandId}?%ZZ-private-query` }, "Preview command arguments must be a JSON array."],
      [{ href: `command:${commandId}`, dataArgs: '{"private-argument":true}' }, "Preview command arguments must be a JSON array."],
      [{ href: `command:${commandId}?%5B%5D`, dataArgs: '["private-conflict"]' }, "Preview command arguments must use either the URL query or data-args, not both."],
      [{ href: `command:${commandId}`, dataArgs: '[{"scheme":"file","path":42,"query":"private-uri"}]' }, "Invalid URI argument in preview command link."],
    ] as const) {
      await panel.send({ ...message(), link });
      assert.strictEqual(notifications[notifications.length - 1], expected);
    }
    assert.strictEqual(notifications.length, 5);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("reports blocked commands without exposing arguments", async function () {
    // A valid invocation can still be denied. Its arguments must not appear in
    // the denial, and it must never fall back to opening the command URL.
    await configuration().update("allowedCommands", [], vscode.ConfigurationTarget.Global);
    await panel.send({ ...message(), link: { href: `command:${commandId}`, dataArgs: '["private-argument"]' } });
    assert.deepStrictEqual(notifications, [
      "This preview command is blocked. Only allow it in Quarto Preview: Allowed Commands in User or Remote User Settings if you trust the document.",
    ]);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("reports execution errors safely and accepts a subsequent valid click", async function () {
    // Both thrown exceptions and rejected promises can contain private data.
    // Exercise real VS Code dispatch and ensure a failure does not disable links.
    for (const execute of [
      () => { throw new Error("private-synchronous-error"); },
      async () => { throw new Error("private-asynchronous-error"); },
    ]) {
      registration.dispose();
      registration = vscode.commands.registerCommand(commandId, execute);
      await panel.send({ ...message(), link: { href: `command:${commandId}`, dataArgs: '["private-argument"]' } });
    }
    const expected = "Preview command failed. Check that the command is available and its arguments are valid.";
    assert.deepStrictEqual(notifications, [expected, expected]);
    registration.dispose();
    registration = vscode.commands.registerCommand(commandId, (...args: unknown[]) => { calls.push(args); });
    await panel.send(message());
    assert.deepStrictEqual(calls, [[]]);
    assert.deepStrictEqual(notifications, [expected, expected]);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("reports malformed User permissions without executing the command", async function () {
    // A list containing the requested ID is still invalid if another entry is
    // malformed. The host must report configuration failure, not grant access.
    await configuration().update("allowedCommands", [commandId, ""], vscode.ConfigurationTarget.Global);
    await panel.send(message());
    assert.deepStrictEqual(notifications, [
      "Quarto Preview: Allowed Commands must be an array of nonempty command IDs without whitespace in User or Remote User Settings.",
    ]);
    assert.deepStrictEqual(calls, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("ignores real workspace grants and preserves User grants", async function () {
    // Verify inspect().globalValue with VS Code's actual configuration layers.
    // Restore the writable test-workspace setting even if an assertion fails.
    const originalWorkspacePermissions = configuration().inspect("allowedCommands")?.workspaceValue;
    try {
      await configuration().update("allowedCommands", [], vscode.ConfigurationTarget.Global);
      await configuration().update("allowedCommands", [commandId], vscode.ConfigurationTarget.Workspace);
      await panel.send(message());
      assert.deepStrictEqual(calls, []);
      await configuration().update("allowedCommands", [commandId], vscode.ConfigurationTarget.Global);
      await configuration().update("allowedCommands", [], vscode.ConfigurationTarget.Workspace);
      await panel.send(message());
      assert.deepStrictEqual(calls, [[]]);
    } finally {
      await configuration().update("allowedCommands", originalWorkspacePermissions, vscode.ConfigurationTarget.Workspace);
    }
  });

  test("does not authorize a composite command through its allowed nested command", async function () {
    // Setup allows only the nested test command. runCommands needs its own
    // explicit grant even though the action it would invoke is already allowed.
    await panel.send({ ...message(), link: {
      href: "command:runCommands",
      dataArgs: JSON.stringify([{ commands: [commandId] }]),
    } });
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(notifications.length, 1);
    assert.deepStrictEqual(openedUrls, []);
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

  test("clearing or disposing a preview prevents subsequent command dispatch", async function () {
    // A queued click can arrive after clear while the old page is still visible.
    // Reopening establishes a new session; disposing removes the message listener.
    await panel.send(message());
    view.clear();
    await panel.send(message());
    assert.strictEqual(calls.length, 1);
    view.show({ url: `${origin}/proxy/4321/index.html`, commandToken: "session-two" });
    const current = { ...message(), token: "session-two" };
    await panel.send(current);
    assert.strictEqual(calls.length, 2);
    view.dispose();
    await panel.send(current);
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(openedUrls, []);
  });

  test("escapes URL entities when writing the preview settings attribute", function () {
    // Entity-looking URL text must survive embedding in an HTML attribute.
    view.show({ url: `${origin}/index.html?value=&quot;&other=<test>`, commandToken: "session-two" });
    assert.ok(panel.webview.html.includes("&amp;quot;&amp;other=&lt;test&gt;"));
  });
});
