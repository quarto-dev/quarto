/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { build, Format, Platform, PluginBuild } from 'esbuild';
import { AssetPair, copy } from 'esbuild-plugin-copy';
import { rm } from 'node:fs/promises';

export interface BuildOptions {
  entryPoints: string[];
  outfile?: string;
  outdir?: string;
  assets?: Array<AssetPair>;
  bundle?: boolean;    // true
  minify?: boolean;    // false
  format?: Format;     // cjs
  platform?: Platform; // node
  external?: string[]; // []
  dev?: boolean;       // false
  sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both'; // false
  legalComments?: 'none' | 'inline' | 'eof' | 'linked' | 'external'; // eof
}

export async function runBuild(options: BuildOptions) {
  const {
    entryPoints,
    outfile,
    outdir,
    assets,
    bundle = true,
    minify = false,
    format = 'cjs',
    platform = 'node',
    external,
    dev = false,
    sourcemap = dev,
    legalComments = 'eof'
  } = options;

  await build({
    entryPoints,
    outfile,
    outdir,
    bundle,
    minify,
    format,
    platform,
    external,
    sourcemap,
    legalComments,
    watch: dev ? {
      onRebuild(error) {
        if (error)
          console.error('[watch] build failed:', error);
        else
          console.log('[watch] build finished');
      },
    } : false,
    plugins: [
      ...(outdir ? [{
        name: 'clear-outdir',
        setup(build: PluginBuild) {
          build.onStart(async () => {
            console.log(`Clearing the ${outdir} directory`);
            await rm(outdir, { recursive: true, force: true });
            console.log(`Cleared the ${outdir} directory`);
          });
        },
      }] : []),
      ...(assets ? [copy({
        resolveFrom: 'cwd',
        assets,
      })] : []),
    ],
  });

  if (dev) {
    console.log("[watch] build finished, watching for changes...");
  }
}
