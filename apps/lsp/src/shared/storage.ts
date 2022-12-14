/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import * as uuid from "uuid";

import { quartoCacheDir } from "./appdirs";

export function fileCrossrefIndexStorage(file: string) {
  return fileScratchStorage(file, "xref.json");
}

export function fileScratchStorage(file: string, scope: string, dir?: boolean) {
  // determine uuid for file scratch storage
  file = path.normalize(file);
  const index = readFileScratchStorageIndex();
  let fileStorage = index[file];
  if (!fileStorage) {
    fileStorage = uuid.v4();
    index[file] = fileStorage;
    writeFileScratchStorageIndex(index);
  }

  // ensure the dir exists
  const scratchStorageDir = fileScratchStoragePath(fileStorage);
  if (!fs.existsSync(scratchStorageDir)) {
    fs.mkdirSync(scratchStorageDir);
  }

  // return the path for the scope (creating dir as required)
  const scopedScratchStorage = path.join(scratchStorageDir, scope);
  if (dir) {
    if (!fs.existsSync(scopedScratchStorage)) {
      fs.mkdirSync(scopedScratchStorage);
    }
  }
  return scopedScratchStorage;
}

function readFileScratchStorageIndex(): Record<string, string> {
  const index = fileScratchStorageIndexPath();
  if (fs.existsSync(index)) {
    return JSON.parse(fs.readFileSync(index, { encoding: "utf-8" }));
  }
  return {};
}

function writeFileScratchStorageIndex(index: Record<string, string>) {
  fs.writeFileSync(
    fileScratchStorageIndexPath(),
    JSON.stringify(index, undefined, 2),
    { encoding: "utf-8" }
  );
}

const fileScratchStorageIndexPath = () => fileScratchStoragePath("INDEX");

function fileScratchStoragePath(file?: string) {
  const storagePath = path.join(quartoCacheDir(), "file-storage");
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath);
  }
  return file ? path.join(storagePath, file) : storagePath;
}
