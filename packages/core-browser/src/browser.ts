/*
 * browser.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


export function qtWebEngineVersion() {
  const pattern = new RegExp("QtWebEngine/([^\\s]+)", "i");
  const match = navigator.userAgent.match(pattern);
  if (match) {
    return match[1];
  } else {
    return undefined;
  }
}

export function isWindows() {
  return navigator.userAgent.search('Windows') !== -1;
}