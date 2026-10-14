/*
 * strings.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\\{}*+?|^$.[\]()]/g, "\\$&");
}

export function shQuote(value: string): string {
  // Quote the value when it contains whitespace or characters that are special
  // to common shells (PowerShell, bash/sh, cmd), e.g. parentheses. Quoting
  // only on whitespace (the previous behavior) left paths like
  // `C:/dir(name)/file.qmd` unquoted, so PowerShell parsed `(name)` as a
  // subexpression — and `md` is an alias for `mkdir`, which meant a generated
  // `quarto preview <path>` command never ran at all.
  if (/[\s"'`$&;|*?~^<>()[\]{}!#\\]/.test(value)) {
    return `"${value}"`;
  } else {
    return value;
  }
}

export function winShEscape(value: string): string {
  return value.replace(" ", "^ ");
}
