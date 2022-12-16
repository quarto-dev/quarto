import path from 'path'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'


export default defineConfig(env => {
  
  const dev = env.mode === "development";

  return {
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.TERM': '""',
      'process.platform': '""'
    },
    plugins: [
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
      watch: dev ? {} : null,
      lib: {
        entry: 'src/index.ts',
        formats: ['umd'],
        name: "QuartoVisualEditor",
        fileName: () => 'index.js' 
      },
      rollupOptions: {
        external: ['vscode-webview'],
      },
      sourcemap: dev ? 'inline' : false
    }
  };
 
});
