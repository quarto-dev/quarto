// vite.config.ts
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
        src: normalizePath(path.resolve(__dirname, '../vscode/LICENSE')),
        dest: '.',
      },
      {
        src: normalizePath(path.resolve(__dirname, '../vscode/ThirdPartyNotices.txt')),
        dest: '.',
      },
    ],
  }),
];

export default defineConfig({
  esbuild: {
    legalComments: 'eof' as const,
  },
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
