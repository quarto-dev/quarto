/*
 * platform.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import process from "node:process";


export function isWindows() {
  return process.platform === "win32";
}

export function isMac() {
  return process.platform === "darwin";
}

export function isArm_64() {
  return process.arch === "arm64";
}

export function isX86_64() {
  return process.arch === "x64";
}

export function isLinux() {
  return process.platform === "linux";
}


