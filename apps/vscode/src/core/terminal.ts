/*
 * terminal.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as os from "node:os";
import fs from "node:fs";


import { Uri, workspace, extensions, window, env } from "vscode";
import { pathWithForwardSlashes, shQuote, shQuoteUnknownShell, sleep, TerminalShell } from "core";
import { Terminal } from "vscode";
import { QuartoContext, fileCrossrefIndexStorage } from "quarto-core";
import { TerminalOptions } from "vscode";
import { previewDirForDocument, previewTargetDir } from "./doc";
import { activeWorkspaceFolder } from "./workspace";
import { activePythonInterpreter, pythonIsCondaEnv, pythonIsVenv } from "./python";

export interface TerminalEnv {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_PYTHON?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  QUARTO_R?: string;
}

export async function terminalEnv(uri?: Uri): Promise<TerminalEnv> {

  const env: TerminalEnv = {};

  // QUARTO_PYTHON
  const python = await activePythonInterpreter(uri);
  if (python) {
    env.QUARTO_PYTHON = python;
  }

  // QUARTO_R
  const workspaceFolder = activeWorkspaceFolder(uri);
  const rExtension =
    extensions.getExtension("REditorSupport.r") ||
    extensions.getExtension("Ikuyadeu.r");
  if (rExtension) {
    const rPath = workspace.getConfiguration("r.rpath", workspaceFolder?.uri);
    let quartoR: string | undefined;
    switch (os.platform()) {
      case "win32": {
        quartoR = rPath.get("windows");
        break;
      }
      case "darwin": {
        quartoR = rPath.get("mac");
        break;
      }
      case "linux": {
        quartoR = rPath.get("linux");
        break;
      }
    }
    if (quartoR) {
      env.QUARTO_R = quartoR;
    }
  }

  return env;
}

export function terminalOptions(name: string, target: Uri, env: TerminalEnv) {

  // determine preview dir (if any)
  const isFile = fs.statSync(target.fsPath).isFile();
  const previewDir = isFile ? previewDirForDocument(target) : undefined;

  // calculate cwd
  const cwd = previewDir || previewTargetDir(target);

  // create and show the terminal
  const options: TerminalOptions = {
    name,
    cwd,
    env: env as unknown as {
      [key: string]: string | null | undefined;
    },
  };

  // add crossref index path to env (will be ignored if we are in a project)
  if (isFile) {
    options.env!["QUARTO_CROSSREF_INDEX_PATH"] = fileCrossrefIndexStorage(
      target.fsPath
    );
  }

  return options;

}

export function terminalCommand(command: string, context: QuartoContext, target?: Uri) {
  const shell = targetShell(context);
  const quarto = "quarto"; // binPath prepended to PATH so we don't need the full form
  // Note: the executable name must NOT be shell-quoted. PowerShell does not
  // run a line that starts with a quoted string as a command (it needs `&`),
  // so quoting it broke every Windows preview. `quarto` is a fixed literal
  // with no shell-special characters, so it is safe bare in all shells.
  const cmd: string[] = [quarto, command];
  if (target) {
    const targetPath =
      context.useCmd ? target.fsPath : pathWithForwardSlashes(target.fsPath);
    cmd.push(
      shell === undefined ? shQuoteUnknownShell(targetPath) : shQuote(targetPath, shell)
    );
  }
  return cmd;
}

// Map a shell executable path to the quoting rules it needs. Exported for
// unit testing.
export function terminalShellForPath(
  shellPath: string | undefined
): TerminalShell | undefined {
  if (!shellPath) {
    return undefined;
  }
  const base = shellPath
    .split(/[\\/]/)
    .pop()!
    .toLowerCase()
    .replace(/\.(exe|cmd|bat)$/, "");
  if (base === "pwsh" || base === "powershell") {
    return "powershell";
  }
  if (base === "cmd") {
    return "cmd";
  }
  if (base === "bash" || base === "zsh" || base === "sh") {
    return "posix";
  }
  return undefined;
}

// The shell that will interpret a generated terminal command: `useCmd`
// means the command targets cmd.exe (old Quarto on Windows shipped a .cmd
// shim); otherwise the quoting follows the shell the integrated terminal
// will actually start, read from vscode.env.shell. The OS platform alone
// cannot tell us — `terminalOptions()` does not set shellPath, so the
// terminal starts the user's default profile, which on Windows can be
// PowerShell, cmd.exe, Git Bash, or WSL, and on macOS/Linux pwsh or fish.
// Returns undefined when the shell is not recognized; the caller then falls
// back to the pre-shell-aware quoting.
function targetShell(context: QuartoContext): TerminalShell | undefined {
  if (context.useCmd) {
    return "cmd";
  }
  return terminalShellForPath(env.shell);
}

export async function sendTerminalCommand(
  terminal: Terminal,
  terminalEnv: TerminalEnv,
  context: QuartoContext,
  cmd: string[]
) {

  // create cmd text
  const cmdText = context.useCmd
    ? `cmd /C"${cmd.join(" ")}"`
    : cmd.join(" ");

  // show the terminal
  terminal.show(true);

  // delay if required (e.g. to allow conda to initialized)
  // wait for up to 5 seconds (note that we can do this without
  // risk of undue delay b/c the state.isInteractedWith bit will
  // flip as soon as the environment has been activated)
  const requiredDelay = requiredTerminalDelay(terminalEnv);
  if (requiredDelay > 0) {
    const kInterval = 100;
    let totalSleep = 0;
    while (!terminal.state.isInteractedWith && totalSleep < requiredDelay) {
      await sleep(kInterval);
      totalSleep += kInterval;
    }
  }

  // send the command
  terminal.sendText(cmdText, true);
}


export async function killTerminal(name: string, before?: () => Promise<void>) {
  const terminal = window.terminals.find((terminal) => {
    return terminal.name === name;
  });
  if (terminal) {
    if (before) {
      await before();
    }
    terminal.dispose();
  }
}


function requiredTerminalDelay(env?: TerminalEnv): number {
  try {
    if (env?.QUARTO_PYTHON) {
      if (pythonIsVenv(env.QUARTO_PYTHON)) {
        return 5000; // magic number found with trial&error to avoid command clobbering
      } else if (pythonIsCondaEnv(env.QUARTO_PYTHON)) {
        return 5000;
      } else {
        return 0;
      }
    } else {
      return 0;
    }

  } catch (err) {
    console.error(err);
    return 0;
  }
}
