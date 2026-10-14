/*
 * languages.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";

import { Uri, extensions } from "vscode";
import { activeWorkspaceFolder } from "./workspace";

import { shQuote } from "core";

export async function activePythonInterpreter(uri?: Uri) {

  const workspaceFolder = activeWorkspaceFolder(uri);
  const pyExtension = extensions.getExtension("ms-python.python");
  if (pyExtension) {
    if (!pyExtension.isActive) {
      await pyExtension.activate();
    }

    const execDetails = pyExtension.exports.settings.getExecutionDetails(
      workspaceFolder?.uri
    );
    if (Array.isArray(execDetails?.execCommand)) {
      let python = execDetails.execCommand[0] as string;
      if (!path.isAbsolute(python)) {
        const resolved = findOnPath(python);
        if (resolved) {
          python = resolved;
        }
      }
      return python;
    }
  }
}

// Resolve a bare command name against PATH (and PATHEXT on Windows), like
// `which`. Returns undefined for names with a directory part, or if not found.
function findOnPath(command: string): string | undefined {
  if (command.includes("/") || command.includes(path.sep)) {
    return undefined;
  }
  const isWindows = process.platform === "win32";
  const exts = isWindows
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  if (isWindows && command.includes(".")) {
    exts.unshift("");
  }
  for (const entry of (process.env.PATH || "").split(path.delimiter)) {
    const dir = entry.replace(/^"(.*)"$/, "$1");
    if (!dir) {
      continue;
    }
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // not here; keep looking
      }
    }
  }
  return undefined;
}


export function pythonIsVenv(python: string) {
  const binDir = path.dirname(python);
  const venvFiles = ["activate", "pyvenv.cfg", "../pyvenv.cfg"];
  return venvFiles.map((file) => path.join(binDir, file)).some(fs.existsSync);
}

export function pythonIsCondaEnv(python: string) {
  try {
    const args = [
      "-c",
      "import sys, os; print(os.path.exists(os.path.join(sys.prefix, 'conda-meta')))",
    ];
    const output = (
      child_process.execFileSync(shQuote(python), args, {
        encoding: "utf-8",
      }) as unknown as string
    ).trim();
    return output === "True";
  } catch {
    return false;
  }
}
