/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2026 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as vscode from "vscode";
import { QuartoContext } from "quarto-core";

import { terminalCommand, terminalShellForPath } from "../core/terminal";

suite("terminalCommand", function () {
  test("does not quote the quarto executable name", function () {
    // PowerShell does not run a line that starts with a quoted string as a
    // command (it needs `&`), so the executable must stay a bare word.
    const context = { useCmd: false } as unknown as QuartoContext;
    const cmd = terminalCommand("preview", context);
    assert.deepStrictEqual(cmd, ["quarto", "preview"]);
    assert.ok(!/^['"]/.test(cmd[0]), "executable name must not be quoted");
  });

  test("passes the document path as one literal argument", function () {
    // The #1194 fix itself: a path with parentheses must survive as one
    // literal argument. Quoting shape is shell-dependent (and the test
    // host's default shell varies), so assert singularity and literal
    // survival; exact serializer output is covered by the shQuote tests.
    const context = { useCmd: false } as unknown as QuartoContext;
    const target = vscode.Uri.file("C:/Users/me/Article(md)/01_introduction.md");
    const cmd = terminalCommand("preview", context, target);
    assert.strictEqual(cmd[0], "quarto");
    assert.strictEqual(cmd[1], "preview");
    assert.strictEqual(cmd.length, 3, "document path must be a single argument");
    assert.ok(
      cmd[2].includes("Article(md)"),
      `document path must survive literally, got: ${cmd[2]}`
    );
  });
});

suite("terminalShellForPath", function () {
  test("maps the terminal's actual shell to quoting rules", function () {
    // terminalCommand() quotes for the shell the terminal will actually
    // start (vscode.env.shell), not the OS platform (quarto-dev/quarto#1197).
    const cases: Array<[string | undefined, string | undefined]> = [
      ["C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "powershell"],
      ["/usr/local/bin/pwsh", "powershell"],
      ["C:\\Windows\\System32\\cmd.exe", "cmd"],
      ["/bin/bash", "posix"],
      ["/bin/zsh", "posix"],
      ["/bin/sh", "posix"],
      ["/usr/bin/fish", undefined],
      ["", undefined],
      [undefined, undefined],
    ];
    for (const [shellPath, expected] of cases) {
      assert.strictEqual(
        terminalShellForPath(shellPath),
        expected,
        `shell path: ${shellPath}`
      );
    }
  });
});
