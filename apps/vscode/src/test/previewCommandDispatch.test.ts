/*
 * previewCommandDispatch.test.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import { commands, Uri } from "vscode";
import { dispatchPreviewCommand, PreviewCommandDispatchHost } from "../providers/preview/command-links";

suite("Preview command VS Code dispatch", function () {
  // These cases require a real extension host, unlike the pure parser tests.
  const commandId = "quarto.test.previewCommandDispatch";

  test("executes a registered command with real top-level Uri arguments", async function () {
    // Record what VS Code delivers to a command after parsing and URI revival.
    let received: unknown[] | undefined;
    const registration = commands.registerCommand(commandId, (...args: unknown[]) => { received = args; });
    try {
      const host: PreviewCommandDispatchHost = {
        createUri: components => Uri.from(components),
        permission: id => id === commandId ? "allowed" : "not-allowed",
        executeCommand: (id, ...args) => commands.executeCommand(id, ...args),
      };
      const result = await dispatchPreviewCommand({ href: `command:${commandId}`, dataArgs: '[{"scheme":"file","path":"/workspace/a b.qmd"},"100%"]' }, host);
      assert.deepStrictEqual(result, { status: "executed" });
      assert.ok(received && received[0] instanceof Uri);
      assert.strictEqual((received![0] as Uri).path, "/workspace/a b.qmd");
      assert.strictEqual(received![1], "100%");
    } finally {
      // Do not leave test commands registered for later cases in the same host.
      registration.dispose();
    }
  });

  test("rejects URI components that the real Uri constructor cannot accept", async function () {
    // Component types alone are insufficient: an authority also constrains path
    // syntax. A real Uri.from failure must become a sanitized validation result.
    const result = await dispatchPreviewCommand({ href: `command:${commandId}`, dataArgs: '[{"scheme":"custom","authority":"example.com","path":"relative"}]' }, {
      createUri: components => Uri.from(components),
      permission: () => "allowed",
      executeCommand: async () => assert.fail("Invalid URI reached dispatch"),
    });
    assert.deepStrictEqual(result, { status: "invalid", reason: "invalid-uri" });
  });

  test("runs a native runCommands sequence without separately allowing its nested command", async function () {
    // Grant only runCommands. VS Code executes the nested command itself, and
    // its nested URI-shaped object must remain an ordinary argument object.
    let received: unknown[] | undefined;
    const checked: string[] = [];
    const registration = commands.registerCommand(commandId, (...args: unknown[]) => { received = args; });
    try {
      const result = await dispatchPreviewCommand({
        href: "command:runCommands",
        dataArgs: JSON.stringify([{ commands: [{ command: commandId, args: ["nested", { scheme: "file", path: "/unchanged" }] }] }]),
      }, {
        createUri: () => assert.fail("Nested URI was converted"),
        permission: id => { checked.push(id); return id === "runCommands" ? "allowed" : "not-allowed"; },
        executeCommand: (id, ...args) => commands.executeCommand(id, ...args),
      });
      assert.deepStrictEqual(result, { status: "executed" });
      assert.deepStrictEqual(checked, ["runCommands"]);
      assert.deepStrictEqual(received, ["nested", { scheme: "file", path: "/unchanged" }]);
    } finally {
      registration.dispose();
    }
  });
});
