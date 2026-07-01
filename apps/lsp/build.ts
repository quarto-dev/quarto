/*
 * build.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
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
