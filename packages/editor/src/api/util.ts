/*
 * util.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

// tslint:disable:no-bitwise
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


// Returns a random string of (alpha)numeric characters of len length.
// Note that this may return strings with leading numbers, which isn't
// allowed for JavaScript identifiers.
export function randomAlphanumeric(len: number, includeLower = true, includeUpper = true) {
  const pool = "0123456789" +
    (includeLower ? "abcdefghijklmnopqrstuvwxyz" : "") +
    (includeUpper ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "");

  return " ".repeat(len).replace(/./g, () => {
    return pool.charAt(Math.floor(Math.random() * pool.length));
  });
}

