/*
 * appdirs.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { appCacheDir, appConfigDir, appDataDir, appRuntimeDir } from "core-node";

const kQuartoDir = "quarto";

export function quartoDataDir(subdir?: string, roaming = false) {
  return appDataDir(kQuartoDir, subdir, roaming);
}

export function quartoConfigDir(subdir?: string, roaming = false) {
  return appConfigDir(kQuartoDir, subdir, roaming);
}

export function quartoCacheDir(subdir?: string) {
  return appCacheDir(kQuartoDir, subdir);
}

export function quartoRuntimeDir(subdir?: string) {
  return appRuntimeDir(kQuartoDir, subdir);
}
