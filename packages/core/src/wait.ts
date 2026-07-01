/*
 * wait.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
