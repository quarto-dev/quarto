/*
 * wait.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
