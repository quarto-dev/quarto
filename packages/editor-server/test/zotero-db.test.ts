/*
 * zotero-db.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { withZoteroDb } from '../src/core/zotero/local/db';

let tmp: string;
let dataDir: string;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zotero-db-test-'));
  // quartoCacheDir() is derived from these, so the copy lands under tmp
  process.env.HOME = tmp;
  process.env.XDG_CACHE_HOME = path.join(tmp, 'cache');
  process.env.LOCALAPPDATA = path.join(tmp, 'cache');

  // a WAL-mode database, like Zotero's
  dataDir = path.join(tmp, 'Zotero');
  fs.mkdirSync(dataDir);
  const db = new DatabaseSync(path.join(dataDir, 'zotero.sqlite'));
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("CREATE TABLE libraries (libraryID INTEGER PRIMARY KEY, type TEXT)");
  db.exec("INSERT INTO libraries VALUES (1, 'user'), (2, 'group')");
  db.close();
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const libraryTypes = () => withZoteroDb(dataDir, async db =>
  db.all("SELECT type FROM libraries WHERE libraryID > :min ORDER BY libraryID", { ':min': 0 })
    .map(row => row.type)
);

const lockDirs = () => fs.readdirSync(tmp, { recursive: true, encoding: 'utf8' })
  .filter(f => f.endsWith('.lock'));

test('queries a copy of a WAL-mode database', async () => {
  assert.deepEqual(await libraryTypes(), ['user', 'group']);
  assert.deepEqual(lockDirs(), []);
});

test('a lock left by a killed process does not block later queries', async () => {
  await libraryTypes();
  const copies = fs.readdirSync(tmp, { recursive: true, encoding: 'utf8' })
    .filter(f => f.endsWith('.sqlite') && !f.startsWith('Zotero'));
  assert.equal(copies.length, 1);
  fs.mkdirSync(path.join(tmp, `${copies[0]}.lock`));

  assert.deepEqual(await libraryTypes(), ['user', 'group']);
  assert.deepEqual(lockDirs(), []);
});

test('concurrent callers are serialized', async () => {
  const results = await Promise.all([libraryTypes(), libraryTypes(), libraryTypes()]);
  assert.deepEqual(results, [['user', 'group'], ['user', 'group'], ['user', 'group']]);
});
