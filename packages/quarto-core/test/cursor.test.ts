/*
 * cursor.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { Position, Range } from "vscode-languageserver-types";

import { Document } from "../src/document";
import { mathRange } from "../src/markdown/cursor";
import { markdownitParser } from "../src/markdown/parsers/markdownit";

function document(text: string): Document {
  return {
    uri: "file:///math.qmd",
    languageId: "quarto",
    version: 1,
    lineCount: 1,
    getText: () => text,
    positionAt: (offset) => Position.create(0, offset),
  };
}

for (const [text, character] of [
  ["Before $$x$$ after", 0],
  ["Before $$x$$ after", 16],
  ["Before $$x$$ and $$y$$ after", 14],
  ["Before $$x$$ and $$y$$ after", 26],
] as const) {
  test(`returns no math at character ${character} in ${JSON.stringify(text)}`, () => {
    assert.equal(
      runInNewContext(
        "mathRange(parser, doc, position)",
        { mathRange, parser: markdownitParser(), doc: document(text), position: Position.create(0, character) },
        { timeout: 1000 }
      ),
      null
    );
  });
}

test("finds later display math and resets the search for repeated requests", () => {
  const parser = markdownitParser();
  const doc = document("Before $$x$$ and $$y$$ after");
  for (const character of [22, 12, 22, 12]) {
    assert.deepEqual(
      runInNewContext(
        "mathRange(parser, doc, position)",
        { mathRange, parser, doc, position: Position.create(0, character) },
        { timeout: 1000 }
      ),
      character === 22
        ? { math: "y", range: Range.create(0, 17, 0, 22) }
        : { math: "x", range: Range.create(0, 7, 0, 12) }
    );
  }
});
