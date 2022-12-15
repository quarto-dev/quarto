/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { lines } from "./text";
import { execProgram } from "core-server";

export function ensureGitignore(
  dir: string,
  entries: string[]
): boolean {
  // if .gitignore exists, then ensure it has the requisite entries
  const gitignorePath = path.join(dir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = lines(
      fs.readFileSync(gitignorePath, {
        encoding: "utf-8",
      })
    ).map((line) => line.trim());
    const requiredEntries: string[] = [];
    for (const requiredEntry of entries) {
      if (!gitignore.includes(requiredEntry)) {
        requiredEntries.push(requiredEntry);
      }
    }
    if (requiredEntries.length > 0) {
      writeGitignore(dir, gitignore.concat(requiredEntries));
      return true;
    } else {
      return false;
    }
  } else {
    // if it doesn't exist then auto-create if we are in a git project or we had the force flag
    try {
      const result = execProgram("git", ["rev-parse"], {
        cwd: dir,
      });
      if (result !== undefined) {
        createGitignore(dir, entries);
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  }
}

export function createGitignore(dir: string, entries: string[]) {
  writeGitignore(dir, entries);
}

function writeGitignore(dir: string, lines: string[]) {
  const lineEnding = os.platform() === "win32" ? "\r\n" : "\n";
  fs.writeFileSync(
    path.join(dir, ".gitignore"),
    lines.join(lineEnding) + lineEnding,
    { encoding: "utf-8" }
  );
}
