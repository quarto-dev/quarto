/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2026 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { pythonIsCondaEnv } from "../core/python";

suite("pythonIsCondaEnv", function () {
  test("accepts a raw interpreter path with shell special characters", function () {
    if (process.platform === "win32") {
      // A shebang script does not run on Windows.
      this.skip();
    }
    // execFileSync does not spawn a shell, so the interpreter path must be
    // passed raw: a shell-quoted path names a file that does not exist, and
    // the function returns false. A shebang script named `python` stands in
    // for a real interpreter without needing conda.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-test-dir (x) $y-"));
    const script = path.join(dir, "python");
    try {
      fs.writeFileSync(script, "#!/bin/sh\necho True\n");
      fs.chmodSync(script, 0o755);
      assert.strictEqual(pythonIsCondaEnv(script), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
