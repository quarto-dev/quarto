// vite.config.ts
import { resolve } from 'path'
import { defineConfig, LibraryFormats } from 'vite'
import dts from 'vite-plugin-dts'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

// allow environment to drive configuration
const types = !(process.env.PANMIRROR_TYPES === "0");
const sourcemap = !(process.env.PANMIRROR_SOURCEMAP === "0");
const formats = (process.env.PANMIRROR_FORMATS || "es").split(",") as LibraryFormats[];
const formatUmd = formats.length === 1 && formats[0] === "umd";
const outDir = process.env.PANMIRROR_OUTDIR || "dist";

// setup plugins
const plugins = [cssInjectedByJsPlugin()];
if (types) {
  plugins.push(dts({entryRoot: 'src'}));
}

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  plugins,
  build: {
    lib: {
      entry: resolve(__dirname, formatUmd ? 'src/index-umd.ts' : 'src/index.ts'),
      name: 'Panmirror',
      formats,
      fileName: (format) => `panmirror.${format === 'umd' ? 'js' : format === 'es' ? 'mjs' : format + '.js'}` 
    },
    rollupOptions: {
      output: {
        assetFileNames: "panmirror.[ext]",
      },
    },
    sourcemap,
    outDir,
    emptyOutDir: false,
  }
})