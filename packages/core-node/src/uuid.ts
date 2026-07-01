/*
 * uuid.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as uuid from "uuid";

export function shortUuid() {
  return uuid.v4().replace(/-/g, "").slice(0, 8);
}
