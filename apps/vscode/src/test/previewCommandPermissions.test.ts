/*
 * command-permissions.ts
 *
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { previewCommandPermission } from "../providers/preview/command-permissions";

const key = "quarto.preview.allowedCommands";
const command = "vscode.open";

suite("Preview command permissions", function () {
  test("registers window scope for User and Remote configuration with an empty default", function () {
    // Window scope keeps the setting visible in code-server's User tab.
    // Read package.json one level above the compiled test-out directory.
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    const setting = manifest.contributes.configuration.properties[key];
    assert.strictEqual(setting.scope, "window");
    assert.deepStrictEqual(setting.default, []);
  });

  test("denies commands by default", function () {
    // Missing settings, defaults and an empty user list must not grant permission.
    assert.strictEqual(previewCommandPermission(command, true, undefined), "not-allowed");
    assert.strictEqual(previewCommandPermission(command, true, { key, defaultValue: [] }), "not-allowed");
    assert.strictEqual(previewCommandPermission(command, true, { key, defaultValue: [command] }), "not-allowed");
    assert.strictEqual(previewCommandPermission(command, true, { key, globalValue: [] }), "not-allowed");
  });

  test("workspace and folder configuration cannot grant permission", function () {
    // Ignore workspace and folder grants, including language overrides.
    assert.strictEqual(previewCommandPermission(command, true, {
      key,
      workspaceValue: [command],
      workspaceFolderValue: [command],
      workspaceLanguageValue: [command],
      workspaceFolderLanguageValue: [command],
    }), "not-allowed");
  });

  test("workspace configuration cannot expand or replace the user list", function () {
    // Workspace settings must not add commands or replace the user's list.
    const setting = {
      key,
      globalValue: [command],
      workspaceValue: ["workbench.action.terminal.new"],
      workspaceFolderValue: [],
    };
    assert.strictEqual(previewCommandPermission(command, true, setting), "allowed");
    assert.strictEqual(previewCommandPermission("workbench.action.terminal.new", true, setting), "not-allowed");
  });

  test("requires workspace trust even when the command is allowed", function () {
    // An allowed command still requires workspace trust.
    assert.strictEqual(previewCommandPermission(command, false, {
      key, globalValue: [command],
    }), "untrusted-workspace");
  });

  test("malformed user configuration fails closed without workspace fallback", function () {
    // Reject invalid user settings, even when workspace settings allow the command.
    for (const globalValue of [null, false, command, {}, [command, 1], [command, ""], [command, "a b"]]) {
      assert.strictEqual(previewCommandPermission(command, true, {
        key, globalValue, workspaceValue: [command],
      }), "invalid-configuration");
    }
  });

  test("matches exact command IDs without wildcards or case folding", function () {
    // Only the exact command ID matches; patterns and different casing do not.
    for (const globalValue of [["*"], ["vscode.*"], ["VSCODE.OPEN"], ["vscode.openWith"]]) {
      assert.strictEqual(previewCommandPermission(command, true, { key, globalValue }), "not-allowed");
    }
  });

  test("observes permission removal and trust changes on the next check", function () {
    // Recheck after permission or trust changes; do not reuse an earlier decision.
    const setting = { key, globalValue: [command] };
    assert.strictEqual(previewCommandPermission(command, true, setting), "allowed");
    setting.globalValue = [];
    assert.strictEqual(previewCommandPermission(command, true, setting), "not-allowed");
    setting.globalValue = [command];
    assert.strictEqual(previewCommandPermission(command, false, setting), "untrusted-workspace");
  });
});
