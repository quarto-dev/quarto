import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

// Compares `actual` with the committed snapshot file. Run the tests with
// UPDATE_SNAPSHOTS=1 to write (or rewrite) the snapshots instead.
export function assertSnapshot(file: string, actual: string) {
  if (process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, actual);
    return;
  }
  assert.ok(fs.existsSync(file), `Missing snapshot ${file}; run the tests with UPDATE_SNAPSHOTS=1 to create it`);
  assert.strictEqual(actual, fs.readFileSync(file, "utf8"), `Output differs from ${file}; if the change is intended, run the tests with UPDATE_SNAPSHOTS=1`);
}
