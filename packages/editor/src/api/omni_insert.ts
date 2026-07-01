/*
 * omni_insert.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { CommandFn } from './command';

// descriptive info for omni insert
export interface OmniInsert {
  name: string;
  keywords?: string[];
  description: string;
  group: OmniInsertGroup;
  priority?: number;
  selectionOffset?: number;
  noFocus?: boolean;
  image: () => string;
}

// descriptive info + ability to identify/execute
export interface OmniInserter extends OmniInsert {
  id: string;
  command: CommandFn;
}

export enum OmniInsertGroup {
  Common = 'Common',
  Headings = 'Headings',
  Lists = 'Lists',
  Math = 'Math',
  References = 'References',
  Content = 'Content',
  Blocks = 'Blocks',
  Chunks = 'Chunks',
}

const omniInsertGroupOrder = new Map<string, number>(Object.keys(OmniInsertGroup).map((key, index) => [key, index]));

export function omniInsertGroupCompare(a: OmniInsert, b: OmniInsert) {
  return omniInsertGroupOrder.get(a.group)! - omniInsertGroupOrder.get(b.group)!;
}

export function omniInsertPriorityCompare(a: OmniInsert, b: OmniInsert) {
  return (a.priority || 0) - (b.priority || 0);
}
