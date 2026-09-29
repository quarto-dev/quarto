/*
 * snapshot.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Compares `actual` with the committed snapshot file. Run the tests with
// UPDATE_SNAPSHOTS=1 to write (or rewrite) the snapshots instead.
export function assertSnapshot(file: string, actual: string) {
  if (process.env.UPDATE_SNAPSHOTS) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, actual);
    return;
  }
  assert.ok(existsSync(file), `Missing snapshot ${file}; run the tests with UPDATE_SNAPSHOTS=1 to create it`);
  assert.equal(actual, readFileSync(file, "utf8"), `Output differs from ${file}; if the change is intended, run the tests with UPDATE_SNAPSHOTS=1`);
}
