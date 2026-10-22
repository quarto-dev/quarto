/*
 * insert_citation-source-panel-packages-sort.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { RPackageInfo } from 'editor-types';

// Case-insensitive alphabetical order by package name. The sort is stable, so
// packages with the same name keep their original relative order.
export function sortPackagesByName(packages: RPackageInfo[]): RPackageInfo[] {
  return [...packages].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  });
}
