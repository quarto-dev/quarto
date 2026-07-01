/*
 * base_64.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// btoa and atob don't handle unicode strings, see
// https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa#Unicode_strings

// these functions implement the suggested workaround ()

export function base64Encode(text: string) {
  const binary = toBinary(text);
  return window.btoa(binary);
}

export function base64Decode(encoded: string) {
  const decoded = atob(encoded);
  return fromBinary(decoded);
}

// convert a Unicode string to a string in which each 16-bit unit occupies only one byte
function toBinary(text: string) {
  const codeUnits = new Uint16Array(text.length);
  for (let i = 0; i < codeUnits.length; i++) {
    codeUnits[i] = text.charCodeAt(i);
  }
  const charCodes = Array.from(new Uint8Array(codeUnits.buffer)).map(code => String.fromCharCode(code));
  return charCodes.join('');
}

// reverse the conversion
function fromBinary(binary: string) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const charCodes = Array.from(new Uint16Array(bytes.buffer)).map(code => String.fromCharCode(code));
  return charCodes.join('');
}
