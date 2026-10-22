/*
 * uuid.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { randomUUID } from "node:crypto";

export function shortUuid() {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}
