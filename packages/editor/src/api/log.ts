/*
 * log.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function logException(e: unknown) {
  // TODO: log exceptions (we don't want to use console.log in production code, so this would
  // utilize some sort of external logging facility)
  if (e instanceof Error) {
     // console.log(e);
  }
}
