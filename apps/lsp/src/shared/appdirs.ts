/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export function quartoDataDir(subdir?: string, roaming = false) {
  return quartoDir(userDataDir, subdir, roaming);
}

export function quartoConfigDir(subdir?: string, roaming = false) {
  return quartoDir(userConfigDir, subdir, roaming);
}

export function quartoCacheDir(subdir?: string) {
  return quartoDir(userCacheDir, subdir);
}

export function quartoRuntimeDir(subdir?: string) {
  return quartoDir(userRuntimeDir, subdir);
}

function quartoDir(
  sourceFn: (appName: string, roaming?: boolean) => string,
  subdir?: string,
  roaming?: boolean
) {
  const dir = sourceFn("quarto", roaming);
  const fullDir = subdir ? path.join(dir, subdir) : dir;
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir);
  }
  return fullDir;
}

export function userDataDir(appName: string, roaming = false) {
  switch (os.platform()) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "win32":
      return windowsUserDataDir(appName, roaming);
    case "linux":
    default:
      return xdgUserDataDir(appName);
  }
}

export function userConfigDir(appName: string, roaming = false) {
  switch (os.platform()) {
    case "darwin":
      return darwinUserDataDir(appName);
    case "win32":
      return windowsUserDataDir(appName, roaming);
    case "linux":
    default:
      return xdgUserConfigDir(appName);
  }
}

export function userCacheDir(appName: string) {
  switch (os.platform()) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "win32":
      return windowsUserDataDir(appName);
    case "linux":
    default:
      return xdgUserCacheDir(appName);
  }
}

export function userRuntimeDir(appName: string) {
  switch (os.platform()) {
    case "darwin":
      return darwinUserCacheDir(appName);
    case "win32":
      return windowsUserDataDir(appName);
    case "linux":
    default:
      return xdgUserRuntimeDir(appName);
  }
}

function darwinUserDataDir(appName: string) {
  return path.join(
    process.env["HOME"] || "",
    "Library",
    "Application Support",
    appName
  );
}

function darwinUserCacheDir(appName: string) {
  return path.join(process.env["HOME"] || "", "Library", "Caches", appName);
}

function xdgUserDataDir(appName: string) {
  const dataHome =
    process.env["XDG_DATA_HOME"] ||
    path.join(process.env["HOME"] || "", ".local", "share");
  return path.join(dataHome, appName);
}

function xdgUserConfigDir(appName: string) {
  const configHome =
    process.env["XDG_CONFIG_HOME"] ||
    path.join(process.env["HOME"] || "", ".config");
  return path.join(configHome, appName);
}

function xdgUserCacheDir(appName: string) {
  const cacheHome =
    process.env["XDG_CACHE_HOME"] ||
    path.join(process.env["HOME"] || "", ".cache");
  return path.join(cacheHome, appName);
}

function xdgUserRuntimeDir(appName: string) {
  const runtimeDir = process.env["XDG_RUNTIME_DIR"];
  if (runtimeDir) {
    return runtimeDir;
  } else {
    return xdgUserDataDir(appName);
  }
}

function windowsUserDataDir(appName: string, roaming = false) {
  const dir =
    (roaming ? process.env["APPDATA"] : process.env["LOCALAPPDATA"]) || "";
  return path.join(dir, appName);
}
