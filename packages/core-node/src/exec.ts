/*
 * exec.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import * as child_process from "node:child_process";

const DEFAULT_MAX_BUFFER = 1000 * 1000 * 100

// helper to run a program and capture its output
export function execProgram(
  program: string,
  args: string[],
  options?: child_process.ExecFileSyncOptions
) {
  return (
    child_process.execFileSync(program, args, {
      encoding: "utf-8",
      maxBuffer: DEFAULT_MAX_BUFFER,
      ...options,
    }) as unknown as string
  ).trim();
}
