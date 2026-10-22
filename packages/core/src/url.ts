/*
 * url.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export function isHttpUrl(path: string) {
  try {
    const url = new URL(path);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}


