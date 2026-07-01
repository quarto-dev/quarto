/*
 * knitr.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import fs from "node:fs"
import path from "node:path"


export function isKnitrSpinScript(file: string, contents?: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext == ".r") {
    contents = contents || fs.readFileSync(file, { encoding: "utf-8" });
    // Consider a .R script that can be spinned if it contains a YAML header inside a special `#'` comment
    return /^\s*#'\s*---[\s\S]+?\s*#'\s*---/.test(contents);
  } else {
    return false;
  }  
}
