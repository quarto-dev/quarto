/*
 * strings.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\\{}*+?|^$.[\]()]/g, "\\$&");
}

export function shQuote(value: string): string {
  if (/\s/g.test(value)) {
    return `"${value}"`;
  } else {
    return value;
  }
}

export function winShEscape(value: string): string {
  return value.replace(" ", "^ ");
}
