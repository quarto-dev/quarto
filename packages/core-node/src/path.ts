/*
 * path.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as path from 'node:path';

export function hasExtension(file: string, ext: string | string[]) {
  if (!Array.isArray(ext)) {
    ext = [ext];
  }
  ext = ext.map(x => x.toLowerCase())
  const fileExt = path.extname(file).toLowerCase();
  return ext.some(ext => ext == fileExt);  
}