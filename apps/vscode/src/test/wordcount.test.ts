/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2026 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { Token, markdownitParser } from "quarto-core";
import { countDocument, countSections, countText } from "../providers/wordcount/count";

// a small document exercising: yaml front matter, nested headings, a paragraph
// with an inline link, a bullet list, and an executable code cell
const kFixture = `---
title: "Test"
author: "Jane"
---

# Introduction

This is a short paragraph with a [link](http://example.com) inside.

- first item
- second item

## Methods

We ran the analysis here.

\`\`\`{r}
x <- 1
mean(x)
\`\`\`

# Conclusion

All done now.
`;

function parse(text: string): Token[] {
  const parser = markdownitParser();
  const doc = {
    uri: "file:///wordcount-test.qmd",
    version: 1,
    lineCount: text.split("\n").length,
    getText: () => text,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser(doc as any);
}

suite("Word count", function () {
  const tokens = parse(kFixture);

  test("counts prose per section, excluding code/yaml by default", function () {
    const sections = countSections(tokens, kFixture, { includeCodeCells: false });
    assert.deepStrictEqual(
      sections.map((s) => s.words),
      // Introduction (paragraph + link + list + nested Methods heading + Methods
      // paragraph) = 19; Methods (paragraph) = 5; Conclusion (paragraph) = 3
      [19, 5, 3]
    );
    assert.deepStrictEqual(
      sections.map((s) => s.level),
      [1, 2, 1]
    );
  });

  test("counts the whole document, excluding code/yaml by default", function () {
    const total = countDocument(tokens, kFixture, { includeCodeCells: false });
    assert.strictEqual(total, 24);
  });

  test("includes code cells when requested", function () {
    const sections = countSections(tokens, kFixture, { includeCodeCells: true });
    // the {r} cell adds words to the sections that contain it
    assert.deepStrictEqual(
      sections.map((s) => s.words),
      [23, 9, 3]
    );
    const total = countDocument(tokens, kFixture, { includeCodeCells: true });
    assert.strictEqual(total, 28);
  });

  test("counts an arbitrary selection of text", function () {
    assert.strictEqual(countText("We ran the analysis here."), 5);
    // inline markup is reduced before counting
    assert.strictEqual(countText("a [link](http://example.com) here"), 3);
    // line breaks separate words
    assert.strictEqual(countText("one two\nthree four"), 4);
    assert.strictEqual(countText(""), 0);
  });
});
