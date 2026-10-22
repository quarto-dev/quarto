/*
 * fetch.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

// The global fetch (undici) rejects with `TypeError: fetch failed` and puts the
// underlying system error (e.g. `getaddrinfo ENOTFOUND api.crossref.org`) in `cause`

// DNS failures: the host doesn't exist or we're offline
const kNoHostCodes = ["ENOTFOUND", "EAI_AGAIN"];

export function isNoHostError(error: unknown): boolean {
  const cause = errorCause(error);
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  return (typeof code === "string" && kNoHostCodes.includes(code)) ||
    kNoHostCodes.some(c => fetchErrorMessage(error).includes(c));
}

export function fetchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  const cause = errorCause(error);
  return cause instanceof Error ? `${message}: ${cause.message}` : message;
}

function errorCause(error: unknown): unknown {
  return error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
}
