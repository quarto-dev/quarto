/*
 * storage.ts
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


import path, { join } from "path";
import fs from "fs";

import { shortUuid } from "core-node";
import { quartoDataDir } from "quarto-core";
import { User } from "./api";

export function userWebCollectionsDir(user: User) {

  // find already provisioned dir
  const userRefFile = userWebCollectionsRefFile(user);
  if (fs.existsSync(userRefFile)) {
    const userSubDir = fs.readFileSync(userRefFile, { encoding: "utf8" });
    const userDir = path.join(webCollectionsDir(), userSubDir);
    if (fs.existsSync(userDir)) {
      return userDir;
    }
  }

  // provision a new dir
  const newDir = provisionUserWebCollectionsDir(user);
  assignUserWebCollectionsDir(user, newDir);
  return newDir;  
}

export function provisionUserWebCollectionsDir(user: User) {
  const rootDir = webCollectionsDir();
  let userDir: string | undefined;
  do {
    userDir = path.join(rootDir, `${user.userID}-${shortUuid()}`);
  } while(fs.existsSync(userDir));
  fs.mkdirSync(userDir, { recursive: true });
  return userDir;
}

export function assignUserWebCollectionsDir(user: User, dir: string) {
  // write the file
  const userRefFile = userWebCollectionsRefFile(user);
  fs.writeFileSync(userRefFile, path.basename(dir), { encoding: "utf8" });

  // cleanup invalidated dirs
  cleanupOldUserWebCollectionsDirs(user, dir);
}

function cleanupOldUserWebCollectionsDirs(user: User, currentDir: string) {
  // cleanup invalidated dirs
  const listing = fs.readdirSync(webCollectionsDir(), { withFileTypes: true });
  listing.forEach(dirent => {
    if (dirent.isDirectory() && dirent.name.startsWith(`${user.userID}-`)) {
      if (dirent.name !== path.basename(currentDir)) {
        fs.rmSync(join(webCollectionsDir(), dirent.name), { recursive: true, force: true });
      }
    }
  })
}

function userWebCollectionsRefFile(user: User) {
  return path.join(webCollectionsDir(), String(user.userID));
}

function webCollectionsDir() {
  return quartoDataDir(path.join("zotero", "collections", "web"));
}