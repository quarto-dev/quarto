/*
 * db.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */



import * as fs from "node:fs";
import * as path from "node:path";

import { Database } from "node-sqlite3-wasm";

import { quartoCacheDir } from "quarto-core";
import { md5Hash } from "core-node";
import { zoteroTrace } from "../trace";

// Concurrent callers (e.g. getCollections + getActiveCollectionSpecs) share a
// copy path per dataDir; without serializing them, one call's copy/open can
// race another's and delete the file out from under it. Queue per dataDir.
const dbQueues = new Map<string, Promise<unknown>>();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function withZoteroDb<T>(dataDir: string, f: (db: Database) => Promise<T>): Promise<T> {
  const previous = dbQueues.get(dataDir) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => withZoteroDbExclusive(dataDir, f));
  dbQueues.set(dataDir, current);
  current.catch(() => undefined).finally(() => {
    if (dbQueues.get(dataDir) === current) {
      dbQueues.delete(dataDir);
    }
  });
  return current;
}

async function withZoteroDbExclusive<T>(dataDir: string, f: (db: Database) => Promise<T>): Promise<T> {

  // get path to actual sqlite db
  const dbFile = path.join(dataDir, "zotero.sqlite");

  // get path to copy of file we will use for queries
  const dbCopyFile = zoteroSqliteCopyPath(dataDir);

  // do the copy if we need to
  const dbFileStat = fs.statSync(dbFile);
  const dbCopyFileMtime = fs.existsSync(dbCopyFile) ? fs.statSync(dbCopyFile).mtime : 0;
  const databaseIsStale = dbCopyFileMtime < dbFileStat.mtime;
  if (databaseIsStale) {
    zoteroTrace(`Copying ${dbFile}`);
    fs.copyFileSync(dbFile, dbCopyFile);
    // node-sqlite3-wasm can't open a WAL-mode database (Zotero's default);
    // clearing the WAL flag just makes the already-copied data openable.
    forceLegacyJournalMode(dbCopyFile);
    fs.utimesSync(dbCopyFile, dbFileStat.atime, dbFileStat.mtime);
  }

   // create connection
   let db : Database | undefined;
   try {
     // attempt open
     db = new Database(dbCopyFile, { fileMustExist: true });
    // try a simple query to validate the connection
     try {
      db.exec("SELECT * FROM libraries");
    } catch(error) {
      const closeDb = db;
      db = undefined;
      closeDb.close();
      console.error(error);
      throw error;
    }
    
    // execute the function
    return f(db);

  } finally {
    // if we have a db then close it
    if (db) {
      try {
        db.close();
      } catch (error) {
        console.log(error);
      }
    } else {
      // no db means we couldn't open it, remove it
      try {
        fs.rmSync(dbCopyFile);
      } catch(error) {
        console.error(error);
      }
    }
  }

}

// File header offset 18-19 flags journal mode (1 = legacy, 2 = WAL);
// flipping it doesn't touch page data, just what a reader assumes.
function forceLegacyJournalMode(dbFile: string) {
  const kJournalModeOffset = 18;
  const kLegacyJournalMode = 1;
  const fd = fs.openSync(dbFile, "r+");
  try {
    const versionBytes = Buffer.alloc(2);
    fs.readSync(fd, versionBytes, 0, 2, kJournalModeOffset);
    if (versionBytes[0] !== kLegacyJournalMode || versionBytes[1] !== kLegacyJournalMode) {
      versionBytes.fill(kLegacyJournalMode);
      fs.writeSync(fd, versionBytes, 0, 2, kJournalModeOffset);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function zoteroSqliteDir() {
  const sqliteDir = path.join(quartoCacheDir("zotero"), "sqlite");
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
  return sqliteDir;
}

function zoteroSqliteCopyPath(dataDir: string) {
  const sqliteFile = `${md5Hash(dataDir)}.sqlite`;
  return path.join(zoteroSqliteDir(), sqliteFile);
  
}



