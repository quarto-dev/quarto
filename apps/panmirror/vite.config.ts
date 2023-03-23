import * as fs from "fs";
import * as path from "path";

// vite.config.ts
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// allow environment to drive output dir
const outDir = process.env.PANMIRROR_OUTDIR || "dist";

// setup plugins
const plugins = [
  cssInjectedByJsPlugin(),
  {
    // https://github.com/vitejs/vite/issues/11986
    // https://github.com/rollup/rollup/issues/4861
    name: 'my:jsondiffpatch',
    configResolved() {
      const cjsFile = require.resolve('jsondiffpatch');
      const cjsCode = fs.readFileSync(cjsFile, 'utf-8');
      const cjsModifiedCode = cjsCode.replace(
        `var chalk = _interopDefault(require('chalk'));`,
        'var chalk = null;',
      );
      fs.writeFileSync(cjsFile, cjsModifiedCode);

      const esmFile = cjsFile.replace(
        path.join('jsondiffpatch.cjs.js'),
        path.join('jsondiffpatch.esm.js'),
      );
      const esmCode = fs.readFileSync(esmFile, 'utf-8');
      const esmModifiedCode = esmCode.replace(
        `import chalk from 'chalk';`,
        'const chalk = null;',
      );
      fs.writeFileSync(esmFile, esmModifiedCode);
    },
  },
];

export default defineConfig({
  define: {
    'process.env.DEBUG': '""',
    'process.env.NODE_ENV': '"production"',
    'process.env.TERM': '""',
    'process.platform': '""'
  },
  plugins,
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Panmirror',
      formats: ['umd'],
      fileName: () => 'panmirror.js' 
    },
    rollupOptions: {
      output: {
        assetFileNames: "panmirror.[ext]",
      },
    },
    sourcemap: false,
    outDir,
    emptyOutDir: false,
  }
})