/*
 * types.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export interface SyncActions<T> {
  deleted: string[];
  updated: T[];
}

export interface SyncProgress {
  report: (message: string, increment?: number) => void;
  log: (message: string) => void;
  cancelled: () => boolean;
}
