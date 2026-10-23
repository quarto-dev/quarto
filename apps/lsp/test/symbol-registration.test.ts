/*
 * symbol-registration.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import assert from "node:assert/strict";
import test from "node:test";

import { documentSymbolRegistrar } from "../src/symbol-registration";

// Stands in for `connection.client.register`: like the real client, the ack
// arrives asynchronously, which is what lets overlapping updates interleave.
function fakeClient() {
  // registration id -> the outline setting it was registered for
  const active = new Map<number, boolean>();
  const errors: unknown[] = [];
  let calls = 0;
  let rejectNext: Error | undefined;

  const register = async (showCodeCellsInOutline: boolean) => {
    const id = ++calls;
    await new Promise(resolve => setTimeout(resolve, 10));
    if (rejectNext) {
      const error = rejectNext;
      rejectNext = undefined;
      throw error;
    }
    active.set(id, showCodeCellsInOutline);
    return { dispose: () => { active.delete(id); } };
  };

  return {
    active,
    errors,
    get calls() { return calls; },
    rejectNextWith(error: Error) { rejectNext = error; },
    registrar: documentSymbolRegistrar(register, error => { errors.push(error); }),
  };
}

test("first update registers once", async () => {
  const client = fakeClient();
  await client.registrar.update(true);
  assert.equal(client.calls, 1);
  assert.equal(client.active.size, 1);
});

test("skips re-registration when the outline setting is unchanged", async () => {
  const client = fakeClient();
  await client.registrar.update(true);
  let last: Promise<void> | undefined;
  for (let i = 0; i < 5; i++) {
    last = client.registrar.update(true);
  }
  await last;
  assert.equal(client.calls, 1);
  assert.equal(client.active.size, 1);
});

test("overlapping updates leave exactly one active registration", async () => {
  const client = fakeClient();
  client.registrar.update(true);
  client.registrar.update(false);
  await client.registrar.update(true);
  assert.equal(client.active.size, 1);
});

test("rapid toggles end with one registration for the last value", async () => {
  const client = fakeClient();
  await client.registrar.update(true);
  client.registrar.update(false);
  client.registrar.update(true);
  await client.registrar.update(false);
  assert.deepEqual([...client.active.values()], [false]);
});

test("a failed registration is logged and the next update retries", async () => {
  const client = fakeClient();
  const boom = new Error("boom");
  client.rejectNextWith(boom);
  await client.registrar.update(true);
  assert.deepEqual(client.errors, [boom]);
  assert.equal(client.active.size, 0);

  await client.registrar.update(true);
  assert.equal(client.calls, 2);
  assert.equal(client.active.size, 1);
});
