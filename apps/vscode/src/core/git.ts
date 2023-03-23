/*
 * git.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import * as os from "os";

import { lines } from "core";
import { execProgram } from "core-node";
import { URI, Utils } from "vscode-uri";
import { fsExists } from "./fs";
import { workspace } from "vscode";

export async function ensureGitignore(
  dir: URI,
  entries: string[]
): Promise<boolean> {
  // if .gitignore exists, then ensure it has the requisite entries
  const gitignorePath = Utils.joinPath(dir, ".gitignore");
  if (await fsExists(gitignorePath)) {
    const gitignore = lines(
      (await workspace.fs.readFile(gitignorePath)).toString()
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
      const create = 
        dir.authority === "github" || 
        dir.scheme === "file" && !!execProgram("git", ["rev-parse"], { cwd: dir.fsPath });
      if (create) {
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

export function createGitignore(dir: URI, entries: string[]) {
  writeGitignore(dir, entries);
}

function writeGitignore(dir: URI, lines: string[]) {
  const lineEnding = os.platform() === "win32" ? "\r\n" : "\n";
  workspace.fs.writeFile(
    Utils.joinPath(dir, ".gitignore"),
    Buffer.from(lines.join(lineEnding) + lineEnding, "utf-8"),
  );
}
