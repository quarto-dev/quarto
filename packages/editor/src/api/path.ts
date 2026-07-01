/*
 * path.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export function expandPaths(rootPath: string, paths: string[]): string[] {
  return paths.map(path => joinPaths(rootPath, path));
}

export function joinPaths(root: string, path: string) {
  const mergedPath = `${root}/${path}`;

  // Clean out duplicate paths
  return mergedPath.replace(/\/\//g, '/');
}

// Ported from
// https://github.com/denoland/deno_std/tree/main/path
export function isAbsolute(path: string, isWindows: boolean) {

  if (isWindows) {
    // Win32 implementation
    const len = path.length;
    if (len === 0) {
      return false;
    }

    const code = path.charCodeAt(0);
    if (isWinPathSeparator(code)) {
      return true;
    } else if (isWindowsDeviceRoot(code)) {
      // Possible device root

      if (len > 2 && path.charCodeAt(1) === CHAR_COLON) {
        if (isWinPathSeparator(path.charCodeAt(2))) {
          return true;
        }
      }
    }
    return false;

  } else {
    // posix implementation
    return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  }
}

export function getExtension(path: string) {
  // Get the file out of the path
  const fileName = path.split(/[\\/]/).pop();
  if (fileName) {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot > 0) {
      return fileName.slice(lastDot + 1);
    }
  }
  return '';
}

export function changeExtension(path: string, extension: string) {
  const lastDot = path.lastIndexOf('.');
  const pathNoExtension = path.substr(0, lastDot + 1);
  return pathNoExtension + extension;
}

const CHAR_UPPERCASE_A = 65; /* A */
const CHAR_LOWERCASE_A = 97; /* a */
const CHAR_UPPERCASE_Z = 90; /* Z */
const CHAR_LOWERCASE_Z = 122; /* z */
const CHAR_FORWARD_SLASH = 47; /* / */
const CHAR_BACKWARD_SLASH = 92; /* \ */
const CHAR_COLON = 58; /* : */

function isWinPathSeparator(code: number) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}

function isWindowsDeviceRoot(code: number): boolean {
  return (
    (code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z) ||
    (code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z)
  );
}