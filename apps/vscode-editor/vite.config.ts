import path from 'path'
import { defineConfig, normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'


export default defineConfig(env => {
  
  const dev = env.mode === "development";

  return {
    esbuild: {
      legalComments: 'eof' as const,
    },
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
            src: normalizePath(path.resolve(__dirname, './dist/**/*')),
            dest: normalizePath(path.resolve(__dirname, '../vscode/assets/www/editor')),
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
        entry: 'src/index.tsx',
        formats: ['umd'],
        name: "QuartoVisualEditor",
        fileName: () => 'index.js',
        // apps/vscode/src/providers/editor/editor.ts loads style.css
        cssFileName: 'style'
      },
      rollupOptions: {
        external: ['vscode-webview'],
      },
      sourcemap: dev ? 'inline' : false
    }
  };
 
});
