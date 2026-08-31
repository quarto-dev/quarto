import assert from "node:assert/strict";
import test from "node:test";

import MarkdownIt from "markdown-it";
import { mathjaxPlugin } from "../src/markdownit/math";

const parse = (src: string) => {
  const md = new MarkdownIt({ html: true });
  md.use(mathjaxPlugin);
  return md.parse(src, {});
};

test("single-line math with attributes does not swallow the rest of the document", () => {
  const tokens = parse(
    "$$1+1$$ {#eq-spec0}\n\n```{python}\n2+2\n```\n"
  );
  const math = tokens.filter((t) => t.type === "math_block");
  const fences = tokens.filter((t) => t.type === "fence");
  assert.equal(math.length, 1);
  assert.equal(math[0].info, "{#eq-spec0}");
  assert.equal(math[0].content.trim(), "1+1");
  // the token must span only the equation's own line, not the rest of the document
  assert.deepEqual(math[0].map, [0, 1]);
  assert.equal(fences.length, 1);
});

test("single-line math with braces in the expression and attributes", () => {
  // the greedy (.*) for the expression competes with the optional {...} attribute
  // group, so pin the case where the expression itself ends in a brace
  const tokens = parse(
    "$$\\frac{1}{2}$$ {#eq-spec0}\n\n```{python}\n2+2\n```\n"
  );
  const math = tokens.filter((t) => t.type === "math_block");
  const fences = tokens.filter((t) => t.type === "fence");
  assert.equal(math.length, 1);
  assert.equal(math[0].info, "{#eq-spec0}");
  assert.equal(math[0].content.trim(), "\\frac{1}{2}");
  assert.deepEqual(math[0].map, [0, 1]);
  assert.equal(fences.length, 1);
});

test("single-line math without attributes still parses", () => {
  const tokens = parse("$$1+1$$\n\n```{python}\n2+2\n```\n");
  const math = tokens.filter((t) => t.type === "math_block");
  const fences = tokens.filter((t) => t.type === "fence");
  assert.equal(math.length, 1);
  assert.equal(math[0].content.trim(), "1+1");
  assert.equal(fences.length, 1);
});

test("multi-line math with attributes on the closing line still parses", () => {
  const tokens = parse("$$\n1+1\n$$ {#eq-spec0}\n\n```{python}\n2+2\n```\n");
  const math = tokens.filter((t) => t.type === "math_block");
  const fences = tokens.filter((t) => t.type === "fence");
  assert.equal(math.length, 1);
  assert.equal(math[0].info, "{#eq-spec0}");
  assert.equal(math[0].content.trim(), "1+1");
  assert.deepEqual(math[0].map, [0, 3]);
  assert.equal(fences.length, 1);
});

// Unterminated math must not be treated as a block that runs to the end of the
// document. A bare "$$" is what the buffer looks like while a display equation
// is being typed, and consuming the remainder would empty the outline and strip
// the Run Cell affordance from every cell below it.
const unterminated: [string, string][] = [
  ["a bare opening delimiter", "$$\n\n```{python}\n2+2\n```\n"],
  ["an unclosed expression", "$$1+1\n\n```{python}\n2+2\n```\n"],
  ["trailing prose after the close", "$$1+1$$ and more text\n\n```{python}\n2+2\n```\n"],
];

for (const [name, src] of unterminated) {
  test(`math with ${name} does not swallow the rest of the document`, () => {
    const tokens = parse(src);
    const math = tokens.filter((t) => t.type === "math_block");
    const fences = tokens.filter((t) => t.type === "fence");
    assert.equal(math.length, 0);
    assert.equal(fences.length, 1);
  });
}
