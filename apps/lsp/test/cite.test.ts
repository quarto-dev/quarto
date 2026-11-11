/*
 * cite.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import assert from "node:assert/strict";
import test from "node:test";

import { citeAtPosition } from "../src/service/util/refs";

// id of the citation at the start of `needle` in `line`
function citeAt(line: string, needle: string) {
  return citeAtPosition(line, line.indexOf(needle))?.id;
}

test("text after a citation is not a citation", () => {
  const line = "Some text [@smith2020] and more text.";
  assert.equal(citeAt(line, "] and"), undefined);
  assert.equal(citeAt(line, "more"), undefined);
  assert.equal(citeAtPosition(line, line.length), undefined);
});

test("the @ and the key are on the citation", () => {
  const line = "Some text [@smith2020] and more text.";
  assert.deepEqual(citeAtPosition(line, line.indexOf("@")), { id: "smith2020", start: 11, end: 21 });
  assert.equal(citeAt(line, "2020"), "smith2020");
  assert.equal(citeAt("As shown by @key.", "."), undefined);
});

test("several citations in one bracket", () => {
  const line = "[@a; @b]";
  assert.equal(citeAt(line, "@a"), "a");
  assert.equal(citeAt(line, "@b"), "b");
  assert.equal(citeAt(line, ";"), undefined);
  assert.equal(citeAt(line, "]"), undefined);
});
