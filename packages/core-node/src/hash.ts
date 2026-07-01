/*
 * hash.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { createHash } from "node:crypto"

export function md5Hash(content: string) : string {
  return createHash("md5").update(content).digest("hex")
}
