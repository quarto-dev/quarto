/*
 * object.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findValue(key: string, object?: { [key: string]: any }) {
  if (!object) {
    return undefined;
  }

  let value;

  Object.keys(object).some(k => {
    if (k === key) {
      value = object[k];
      return true;
    }
    if (object[k] && typeof object[k] === 'object') {
      value = findValue(key, object[k]);
      return value !== undefined;
    }
    return false;
  });

  return value;
}
