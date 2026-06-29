import assert from "node:assert/strict";
import test from "node:test";

import MarkdownIt from "markdown-it";
import { divPlugin } from "../src/markdownit/divs";

const render = (src: string) => {
  const md = new MarkdownIt({ html: true });
  md.use(divPlugin);
  return md.render(src);
};

test("pandoc divs do not turn soft line breaks into paragraph breaks", () => {
  assert.equal(render("Hello\nworld"), "<p>Hello\nworld</p>\n");
});

test("pandoc div markers still interrupt paragraphs", () => {
  assert.equal(
    render("Before\n:::\nInside\n:::"),
    "<p>Before</p>\n<div  class=\"quarto-div\"><p>Inside</p>\n</div>"
  );
});
