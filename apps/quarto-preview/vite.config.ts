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
            dest: normalizePath(path.resolve(__dirname, '../../../quarto-cli/src/resources/preview'))
          }
        ]
      })
    ],
    build: {
      watch: dev ? {} : null,
      lib: {
        entry: 'src/index.tsx',
        formats: ['umd'],
        name: "QuartoPreview",
        
        fileName: () => 'quarto-preview.js',
      
      },
      rollupOptions: {
        external: [],
        output: {
          assetFileNames: "quarto-preview.[ext]",
        },
      },
      sourcemap: dev ? 'inline' : false
    }
  };
 
});
