/*
 * path.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export function pathWithForwardSlashes(path: string) {
  return path.replace(/\\/g, "/");
}

export function ensureExtension(path: string, extension: string) {
  const parts = path.split(".");
  if (parts.length === 1) {
    return `${path}.${extension}`;
  } else {
    return parts.slice(0, parts.length - 1).concat(extension).join(".");
  }
}
