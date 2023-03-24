// vite.config.ts
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// allow environment to drive output dir
const outDir = process.env.PANMIRROR_OUTDIR || "dist";

// setup plugins
const plugins = [cssInjectedByJsPlugin()];

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