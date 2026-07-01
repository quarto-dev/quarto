/*
 * build.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { runBuild } from "build";
import * as glob from "glob";

const args = process.argv;
const dev = args[2] === "dev";
const test = args[2] === "test";
const testFiles = glob.sync("src/test/{*.ts,fixtures/*.ts,utils/*.ts}");

const testBuildOptions = {
  entryPoints: testFiles,
  outdir: 'test-out',
  external: ['vscode', 'mocha', 'glob'],
  sourcemap: true,
  dev,
};

const defaultBuildOptions = {
  entryPoints: ['./src/main.ts'],
  outfile: './out/main.js',
  external: ['vscode'],
  minify: !dev,
  dev
};

if (test) {
  runBuild(testBuildOptions);
} else if (dev) {
  runBuild(defaultBuildOptions);
  runBuild(testBuildOptions);
} else {
  runBuild(defaultBuildOptions);
}
