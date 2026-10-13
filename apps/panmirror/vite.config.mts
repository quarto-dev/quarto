// vite.config.mts
import path from 'path'
import { defineConfig, normalizePath } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// allow environment to drive output dir
const outDir = process.env.PANMIRROR_OUTDIR || "dist";

// setup plugins
const plugins = [
  cssInjectedByJsPlugin(),
  viteStaticCopy({
    targets: [
      {
        src: normalizePath(path.resolve(import.meta.dirname, '../vscode/LICENSE')),
        dest: '.',
        rename: { stripBase: 1 },
      },
      {
        src: normalizePath(path.resolve(import.meta.dirname, '../vscode/ThirdPartyNotices.txt')),
        dest: '.',
        rename: { stripBase: 1 },
      },
    ],
  }),
];

export default defineConfig({
  define: {
    'process.env.DEBUG': '""',
    'process.env.NODE_ENV': '"production"',
    'process.env.TERM': '""',
    'process.platform': '""'
  },
  // the automatic JSX runtime, set explicitly so it doesn't depend on which
  // tsconfig Oxc finds for files under packages/*
  oxc: { jsx: { runtime: 'automatic' } },
  plugins,
  build: {
    // Vite 3's default ('modules'); RStudio decides whether to raise it
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    lib: {
      entry: 'src/index.ts',
      name: 'Panmirror',
      formats: ['umd'],
      fileName: () => 'panmirror.js' 
    },
    rolldownOptions: {
      output: {
        assetFileNames: "panmirror.[ext]",
        // keep license banners (Vite drops them when minifying)
        comments: { legal: true },
      },
    },
    sourcemap: false,
    outDir,
    emptyOutDir: false,
  }
})
