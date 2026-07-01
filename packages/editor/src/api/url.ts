/*
 * url.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export function isHttpURL(url: string) {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === "http:" || urlObject.protocol === "https:";
 } catch (_) {
    return false;
 }
}