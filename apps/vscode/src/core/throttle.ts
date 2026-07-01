/*
 * throttle.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

/**
 * Creates a throttled version of a function.
 * First call executes immediately, subsequent calls within the delay are coalesced.
 */
export function createThrottle(
  fn: () => any,
  getDelay: () => number
): () => any {
  let timer: NodeJS.Timeout | undefined;
  let pending = false;

  return () => {
    if (timer === undefined) {
      fn();
      timer = setTimeout(() => {
        if (pending) {
          fn();
          pending = false;
        }
        timer = undefined;
      }, getDelay());
    } else {
      pending = true;
    }
  };
}
