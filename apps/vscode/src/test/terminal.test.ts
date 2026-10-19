/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2026 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { execFileSync } from "node:child_process";
import * as vscode from "vscode";
import { pathWithForwardSlashes } from "core";
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

  test("passes the document path to the terminal's shell as one literal argument", function () {
    // Run the generated line through the shell the terminal starts, with a
    // `quarto` function that prints the argument after the subcommand. The
    // $(...) and backtick parts are canaries: if the path were not literal,
    // the shell would run them.
    const shellPath = vscode.env.shell;
    if (terminalShellForPath(shellPath) !== "posix") {
      this.skip();
    }
    const context = { useCmd: false } as unknown as QuartoContext;
    const target = vscode.Uri.file(
      "/tmp/Article(md) $HOME $(echo PWNED) `echo PWNED`/it's;a@b&c.qmd"
    );
    const line = terminalCommand("preview", context, target).join(" ");
    const output = execFileSync(
      shellPath,
      ["-c", `quarto() { printf %s "$2"; }; ${line}`],
      { encoding: "utf-8" }
    );
    assert.strictEqual(output, pathWithForwardSlashes(target.fsPath));
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
