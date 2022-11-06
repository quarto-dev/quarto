// vite.config.ts
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  plugins: [dts(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Panmirror',
      fileName: (format) => `panmirror.${format === 'umd' ? 'js' : format === 'es' ? 'mjs' : format + '.js'}` 
    },
    rollupOptions: {
      output: {
        assetFileNames: "panmirror.[ext]",
      },
    },
    sourcemap: true,
    emptyOutDir: false,
  }
})