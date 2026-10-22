/*
 * trace.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { zoteroTrace } from "../trace";
import { SyncProgress } from "./types";

export { zoteroTrace } from "../trace";

export function zoteroTraceProgress() : SyncProgress {
  return {
    report(message: string) {
      zoteroTrace(message);
    },
    log(url) {
      zoteroTrace(url);
    },
    cancelled() {
      return false;
    },
  }
}
