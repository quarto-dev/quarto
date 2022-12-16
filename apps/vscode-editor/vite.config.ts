
import path from 'path'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { viteStaticCopy } from 'vite-plugin-static-copy'


export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.TERM': '""',
    'process.platform': '""'
  },
  plugins: [
    //cssInjectedByJsPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, './dist/*'),
          dest: path.resolve(__dirname, '../vscode/assets/www/editor')
        }
      ]
    })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['umd'],
      name: "QuartoVisualEditor",
      fileName: () => 'index.js' 
    },
    rollupOptions: {
      output: {
        // assetFileNames:  "index.[ext]"
      },
    },
  }
});
