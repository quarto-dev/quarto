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

const args = process.argv;
const dev = args[2] === "dev";

const nodeSqlLiteWasm = '../../node_modules/node-sqlite3-wasm/dist/*.wasm';

runBuild({
  entryPoints: ['./src/index.ts'],
  outfile: '../vscode/out/lsp/lsp.js',
  assets: [
    { from: [nodeSqlLiteWasm], to: '../vscode/out/lsp/' },
    { from: ['./src/run.js'], to: '../vscode/out/lsp' },
    { from: ['../../packages/editor-server/src/resources/**'], to: '../vscode/out/lsp/resources/' },
    { from: ['../../packages/quarto-core/src/resources/**'], to: '../vscode/out/lsp/resources/' }
  ],
  minify: !dev,
  dev
})
