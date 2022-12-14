/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from "child_process";

// helper to run a program and capture its output
export function execProgram(
  program: string,
  args: string[],
  options?: child_process.ExecFileSyncOptions
) {
  return (
    child_process.execFileSync(program, args, {
      encoding: "utf-8",
      ...options,
    }) as unknown as string
  ).trim();
}
