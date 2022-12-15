import { build } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

const args = process.argv;
const dev = args[2] === "dev";

(async () => {
  await build({
    entryPoints: ['./src/server.ts'],
    bundle: true,
    outfile: './dist/lsp.js',
    format: 'cjs',
    platform: 'node',
    sourcemap: dev,
    watch: dev ? {
      onRebuild(error) {
        if (error) 
          console.error('[watch] build failed:', error)
        else 
          console.log('[watch] build finished')
      },
    } : false,
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./dist/lsp.js*'],
          to: ['../vscode/out'],
        },
      }),
    ],
  });
  if (dev) {
    console.log("[watch] build finished, watching for changes...");
  }
})();