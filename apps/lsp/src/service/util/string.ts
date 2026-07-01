/*
 * string.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

export function isEmptyOrWhitespace(str: string): boolean {
  return /^\s*$/.test(str);
}

export const r = String.raw;
