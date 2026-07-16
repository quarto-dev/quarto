/*
 * index.ts
 *
 * Mocha entry point for the Positron-only integration tests. This module is
 * loaded inside the Positron extension host by `@posit-dev/positron-test-electron`
 * (see `scripts/run-positron-tests.mjs`), which requires it and calls `run()`.
 *
 * These tests are kept separate from the main `@vscode/test-cli` suite because
 * they exercise the Positron API, which is only available when the tests run
 * inside Positron rather than vanilla VS Code.
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import * as path from "path";
import * as glob from "glob";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    // Runtime start-up and cross-process execution are slower than the plain
    // VS Code suite, so give each test a generous ceiling.
    timeout: 120000,
  });

  const testsRoot = __dirname;
  const files = glob.sync("**/*.test.js", { cwd: testsRoot });
  files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
