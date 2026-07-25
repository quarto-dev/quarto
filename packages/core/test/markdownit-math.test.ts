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
  assert.equal(fences.length, 1);
});
