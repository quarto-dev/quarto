/*
 * firstrun.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import fs from "fs";
import path from "path";
import { ExtensionContext } from "vscode";

const kQuartoCreateFirstRun = "quarto.create.firstRun";

export function createFirstRun(
  context: ExtensionContext,
  projectDir: string,
  openFiles: string[]
) {
  openFiles = openFiles.map((file) =>
    path.join(projectDir, file.replace("$(dirname)", path.basename(projectDir)))
  );
  context.globalState.update(kQuartoCreateFirstRun, openFiles.join("\n"));
}

export async function collectFirstRun(
  context: ExtensionContext,
  projectDir: string
): Promise<string[]> {
  const firstRun = context.globalState
    .get<string>(kQuartoCreateFirstRun, "")
    .split("\n")
    .filter((file) => file.startsWith(projectDir) && fs.existsSync(file));
  await context.globalState.update(kQuartoCreateFirstRun, undefined);
  return firstRun;
}
