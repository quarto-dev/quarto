
/*
 * cite-completion-search.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */
import Fuse from 'fuse.js';

import { CiteCompletionEntry } from "./cite-completion";

const searchFields: Fuse.FuseOptionKeyObject<CiteCompletionEntry>[] = [
  { name: 'id', weight: 30 },
  { name: 'index.secondary', weight: 30 },
  { name: 'index.tertiary', weight: 5 },
];

export interface CiteCompletionSearch {
  setEntries: (entries: CiteCompletionEntry[]) => void;
  search: (searchTerm: string, limit: number) => CiteCompletionEntry[];
  exactMatch: (searchTerm: string) => boolean;
}

export function completionIndex(defaultEntries?: CiteCompletionEntry[]): CiteCompletionSearch {
  // build search index
  const options = {
    isCaseSensitive: false,
    shouldSort: true,
    includeMatches: false,
    includeScore: false,
    minMatchCharLength: 3,
    threshold: 0.5,
    keys: searchFields,
    useExtendedSearch: true
  };

  defaultEntries = defaultEntries || [];
  const index = Fuse.createIndex<CiteCompletionEntry>(searchFields, defaultEntries);
  const fuse = new Fuse(defaultEntries, options, index);
  let indexedEntries: CiteCompletionEntry[] = [];

  return {
    setEntries: (entries: CiteCompletionEntry[]) => {
      fuse.setCollection(entries);
      indexedEntries = entries;
    },
    search: (searchTerm: string, limit: number): CiteCompletionEntry[] => {
      const results = fuse.search('^' + searchTerm, { ...options, limit });
      return results.map(result => result.item);
    },
    exactMatch: (searchTerm: string): boolean => {
      return indexedEntries.some(entry => entry.id === searchTerm);
    }
  };
}