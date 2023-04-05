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

import fs from "fs";
import path from "path";


import readline from 'readline';

import { quartoDataDir } from "quarto-core";
import { Group, Library, User } from "./api";
import { LibraryObjects, LibraryVersions } from "./libraries";

export function userWebLibrariesDir(user: User) {
  const dir = path.join(webLibrariesDir(), String(user.userID));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}


export function libraryFileName(collectionsDir: string, library: Library) {
  return path.join(collectionsDir, `${library.type}-${library.id}.json`);
}


export function libraryReadObjects(collectionsDir: string, library: Library) : LibraryObjects {
  const libraryFile = libraryFileName(collectionsDir, library);
  if (fs.existsSync(libraryFile)) {
    return JSON.parse(fs.readFileSync(libraryFile, { encoding: "utf8" })) as LibraryObjects
  } else {
    return {
      versions: {
        collections: 0,
        items: 0,
        deleted: 0,
      },
      collections: [],
      items: []
    }
  }
}

export function libraryWriteObjects(collectionsDir: string, library: Library, objects: LibraryObjects) {
  fs.writeFileSync(
    libraryFileName(collectionsDir, library),
    JSON.stringify(objects, null, 2),
    { encoding: "utf-8" } 
  );
}


export async function libraryReadGroup(user: User, library: Library) : Promise<Group | null> {
  return libraryReadObject<Group>(user, library, "group", null)
}

export async function libraryReadVersions(user: User, library: Library) : Promise<LibraryVersions> {
  const noVersions = {
    collections: 0,
    items: 0,
    deleted: 0
  };
  return (await libraryReadObject<LibraryVersions>(user, library, "versions", noVersions)) || noVersions;
}

export async function libraryReadObject<T>(user: User, library: Library, name: string, defaultValue: T | null) : Promise<T | null> {
  // determine library file
  const dir = userWebLibrariesDir(user);
  const libraryFile = libraryFileName(dir, library);

  if (fs.existsSync(libraryFile)) {

    return new Promise((resolve, reject) => {
      
      const fileStream = fs.createReadStream(libraryFile, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });
      const closeStream = () => {
        rl.close();
        fileStream.destroy();
      }

      const nullObjectRegEx = new RegExp('^\\s*"' + name + '":\\s*\\null,\\s*$');
      const startObjectRegEx = new RegExp('^\\s*"' + name + '":\\s*\\{\\s*$');
      let objectBuffer: string[] | undefined;

      rl.on('line', (line) => {
        if (!objectBuffer) {
          if (line.match(nullObjectRegEx)) {
            resolve(null);
            closeStream();
          } else if (line.match(startObjectRegEx)) {
            objectBuffer = ["{"];
          }
        } else if (line.match(/^\s*\},\s*$/)) {
          objectBuffer.push("}");
          const versions = objectBuffer.join("\n");
          try {
            resolve(JSON.parse(versions));
          } catch(error) {
            reject(error);
          } finally {
            closeStream();
          }
        } else {
          objectBuffer.push(line);
        }
      });

      rl.on('close', () => {
        if (objectBuffer === undefined) {
          resolve(defaultValue);
        }
      })

      rl.on('error', (error) => {
        reject(error);
      })

    });
  } else {
    return defaultValue;
  }
}




function webLibrariesDir() {
  return quartoDataDir(path.join("zotero", "collections", "web"));
}

