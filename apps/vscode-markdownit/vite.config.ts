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
            src: normalizePath(path.resolve(__dirname, './dist/*')),
            dest: normalizePath(path.resolve(__dirname, '../vscode/out/markdownit'))
          },
          {
            src: normalizePath(path.resolve(__dirname, './assets/*')),
            dest: normalizePath(path.resolve(__dirname, '../vscode/out/markdownit'))
          }
        ]
      })
    ],
    build: {
      watch: dev ? {} : null,
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => 'index.js' 
      },
      rollupOptions: {
        external: ['vscode-webview', 'vscode-notebook-renderer'],
      },
      sourcemap: dev ? 'inline' : false
    }
  };
 
});
