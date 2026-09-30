import path from 'path'
import { defineConfig, normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'


export default defineConfig(env => {
  
  const dev = env.mode === "development";

  return {
    define: {
      'process.env.DEBUG': '""',
      'process.env.NODE_ENV': '"production"',
      'process.env.TERM': '""',
      'process.platform': '""'
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(path.resolve(import.meta.dirname, './dist/**/*')),
            dest: normalizePath(path.resolve(import.meta.dirname, '../vscode/out/markdownit')),
            // copy dist/<file> to <dest>/<file>, not <dest>/dist/<file>
            rename: { stripBase: 1 }
          }
        ]
      })
    ],
    build: {
      // VS Code 1.101, the supported floor, runs webviews in Chromium 134
      target: 'chrome134',
      watch: dev ? {} : null,
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => 'index.js' 
      },
      rolldownOptions: {
        external: ['vscode-webview', 'vscode-notebook-renderer'],
        // keep license banners (Vite drops them when minifying)
        output: {
          comments: { legal: true },
          // the package isn't "type": "module" (so its tests can load `core`
          // from source), which would otherwise make Vite name chunks .mjs
          chunkFileNames: '[name]-[hash].js',
        },
      },
      sourcemap: dev ? 'inline' : false
    }
  };
 
});
