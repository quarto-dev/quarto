/*
 * fetch.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchErrorMessage, isNoHostError } from '../src/core/fetch';
import { handleResponseWithStatus } from '../src/server/response';
import { kStatusError, kStatusNoHost } from 'editor-types';

const systemError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const fetchFailed = (cause: unknown) => new TypeError('fetch failed', { cause });

test('DNS failures in the error cause are no-host errors', () => {
  assert.ok(isNoHostError(fetchFailed(systemError('ENOTFOUND', 'getaddrinfo ENOTFOUND api.crossref.org'))));
  assert.ok(isNoHostError(fetchFailed(systemError('EAI_AGAIN', 'getaddrinfo EAI_AGAIN api.crossref.org'))));
});

test('other failures are not no-host errors', () => {
  assert.ok(!isNoHostError(fetchFailed(systemError('ECONNRESET', 'read ECONNRESET'))));
  assert.ok(!isNoHostError(new Error('Unexpected token < in JSON')));
  assert.ok(!isNoHostError('not an error'));
});

test('the error message includes the cause', () => {
  assert.equal(
    fetchErrorMessage(fetchFailed(systemError('ENOTFOUND', 'getaddrinfo ENOTFOUND doi.org'))),
    'fetch failed: getaddrinfo ENOTFOUND doi.org'
  );
  assert.equal(fetchErrorMessage(new Error('boom')), 'boom');
});

test('fetching from a nonexistent host reports no host', async () => {
  // .invalid is reserved (RFC 2606), so it never resolves
  const result = await handleResponseWithStatus(() => fetch('https://quarto.invalid/'));
  assert.equal(result.status, kStatusNoHost);
  assert.match(result.error, /ENOTFOUND|EAI_AGAIN/);
});

test('a non-network failure is a plain error', async () => {
  const result = await handleResponseWithStatus(() => Promise.reject(new Error('boom')));
  assert.equal(result.status, kStatusError);
  assert.equal(result.error, 'boom');
});
