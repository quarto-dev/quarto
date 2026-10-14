import assert from "node:assert/strict";
import test from "node:test";

import { shQuote } from "../src/strings";

test("shQuote leaves plain values unquoted", () => {
  for (const value of ["quarto", "c:/docs/report.qmd", "file-name_123.qmd"]) {
    assert.equal(shQuote(value), value, JSON.stringify(value));
  }
});

test("shQuote quotes values containing whitespace", () => {
  assert.equal(
    shQuote("c:/My Documents/report.qmd"),
    '"c:/My Documents/report.qmd"'
  );
});

test("shQuote quotes values containing shell metacharacters", () => {
  // Parentheses without whitespace: PowerShell parses `(md)` as a
  // subexpression, and `md` is an alias for `mkdir`, so an unquoted path like
  // this broke the generated `quarto preview` command.
  assert.equal(
    shQuote("c:/Users/me/Article(md)/01_introduction.md"),
    '"c:/Users/me/Article(md)/01_introduction.md"'
  );
  for (const value of ["a&b", "a;b", "a$b", "a`b", "a|b", "a*b", "a?b", "a'b"]) {
    assert.equal(shQuote(value), `"${value}"`, JSON.stringify(value));
  }
});
