/*
 * dictionaries.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { appConfigDir } from "core-node";

export function userDictionaryDir() {
  return appConfigDir("quarto-writer", "user-dictionary")
}

