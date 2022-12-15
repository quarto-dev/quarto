/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { appCacheDir, appConfigDir, appDataDir, appRuntimeDir } from "core-server";

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
