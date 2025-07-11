/*
 * build.ts
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

import { runBuild } from "build";
import * as glob from "glob";

const args = process.argv;
const dev = args[2] === "dev";
const test = args[2] === "test";
const testFiles = glob.sync("src/test/*.ts");

const testBuildOptions = {
  entryPoints: testFiles,
  outdir: 'test-out',
  external: ['vscode'],
};

const defaultBuildOptions = {
  entryPoints: ['./src/main.ts'],
  outfile: './out/main.js',
  external: ['vscode'],
  minify: !dev,
  dev
};

runBuild(test ? testBuildOptions : defaultBuildOptions);
