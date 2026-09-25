/*
 * index.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { build, BuildOptions as EsbuildOptions, context, Format, Platform, PluginBuild } from 'esbuild';
import { copyFile, glob, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

// Copy files matching the `from` globs (relative to cwd) into the `to` directory,
// keeping each file's path relative to the non-glob prefix of its pattern
export interface AssetPair {
  from: string[];
  to: string;
}

export interface BuildOptions {
  entryPoints: string[];
  outfile?: string;
  outdir?: string;
  assets?: Array<AssetPair>;
  bundle?: boolean;    // true
  minify?: boolean;    // false
  format?: Format;     // cjs
  platform?: Platform; // node
  target?: string;     // node22
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
    // The Node bundled with the oldest VS Code we support (engines.vscode ^1.101)
    target = 'node22',
    external,
    dev = false,
    sourcemap = dev,
    legalComments = 'eof'
  } = options;

  const esbuildOptions: EsbuildOptions = {
    entryPoints,
    outfile,
    outdir,
    bundle,
    minify,
    format,
    platform,
    target,
    external,
    sourcemap,
    legalComments,
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
      ...(assets ? [{
        name: 'copy-assets',
        setup(build: PluginBuild) {
          build.onEnd(async () => {
            await copyAssets(assets);
          });
        },
      }] : []),
      ...(dev ? [{
        name: 'watch-logger',
        setup(build: PluginBuild) {
          build.onEnd(result => {
            if (result.errors.length > 0)
              console.error('[watch] build failed');
            else
              console.log('[watch] build finished');
          });
        },
      }] : []),
    ],
  };

  if (dev) {
    const ctx = await context(esbuildOptions);
    await ctx.watch();
    console.log("[watch] watching for changes...");
  } else {
    await build(esbuildOptions);
  }
}

async function copyAssets(assets: AssetPair[]) {
  for (const { from, to } of assets) {
    for (const pattern of from) {
      const base = globBase(pattern);
      for await (const file of glob(pattern)) {
        if (!(await stat(file)).isFile()) {
          continue;
        }
        const dest = join(to, relative(base, file));
        await mkdir(dirname(dest), { recursive: true });
        await copyFile(file, dest);
      }
    }
  }
}

function globBase(pattern: string) {
  const segments = pattern.split('/');
  const firstGlob = segments.findIndex(segment => /[*?[\]{}]/.test(segment));
  return firstGlob === -1 ? dirname(pattern) : segments.slice(0, firstGlob).join('/');
}
