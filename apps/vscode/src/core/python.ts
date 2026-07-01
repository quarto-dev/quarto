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

import which from "which";
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
        const path = which.sync(python, { nothrow: true });
        if (path) {
          python = path;
        }
      }
      return python;
    }
  }
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
