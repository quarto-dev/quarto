/*
 * platform.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import process from "node:process";


export function isWindows() {
  return process.platform === "win32";
}

export function isMac() {
  return process.platform === "darwin";
}

export function isMacArm() {
  return isMac() && process.arch === "arm64";
}

export function isMacX86() {
  return isMac() && process.arch === "x64";
}

export function isLinux() {
  return process.platform === "linux";
}


