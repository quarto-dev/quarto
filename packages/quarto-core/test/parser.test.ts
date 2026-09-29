/*
 * parser.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Snapshot tests for the markdown-it document parser behind the language
 * server's and the extension's outline, symbols, folding, code cells and div
 * brackets. Each snapshot has two parts:
 * - `markdownIt`: a compact projection of the block parser's token stream
 *   (nesting, type, tag, map, attrs, info, meta), one token per line
 * - `tokens`: the Quarto tokens that markdownitParser() derives from it
 *
 * The snapshots are in test/snapshots/. To update them after an intended
 * change, run `UPDATE_SNAPSHOTS=1 yarn test` in this directory and review the diff.
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Token } from "markdown-it";

import { markdownitBlockParser, markdownitParser } from "../src/markdown/parsers/markdownit";
import { Token as QToken } from "../src/markdown/token";
import { assertSnapshot } from "./snapshot";

const examplesDir = path.join(__dirname, "..", "..", "..", "apps", "vscode", "src", "test", "examples");

const inputs: Record<string, string> = {
  "quarto-syntax": path.join(__dirname, "fixtures", "quarto-syntax.qmd"),
  "valid-basics-2": path.join(examplesDir, "valid-basics-2.qmd"),
  "valid-nesting": path.join(examplesDir, "valid-nesting.qmd"),
  "attr-equals": path.join(examplesDir, "attr-equals.qmd"),
  "div-code-blocks": path.join(examplesDir, "div-code-blocks.qmd"),
  "simple-divs": path.join(examplesDir, "simple-divs.qmd"),
};

const projectToken = (token: Token) => {
  const parts = [`${"  ".repeat(token.level)}${token.type}`];
  if (token.tag) parts.push(`<${token.tag}>`);
  if (token.map) parts.push(`[${token.map.join(",")}]`);
  if (token.attrs) parts.push(`attrs=${JSON.stringify(token.attrs)}`);
  if (token.info) parts.push(`info=${JSON.stringify(token.info)}`);
  if (token.meta) parts.push(`meta=${JSON.stringify(token.meta)}`);
  return parts.join(" ");
};

const projectQToken = (token: QToken) => {
  const { start, end } = token.range;
  return {
    type: token.type,
    range: `${start.line}:${start.character}-${end.line}:${end.character}`,
    ...(token.attr ? { attr: token.attr } : {}),
    ...(token.data !== null ? { data: token.data } : {}),
  };
};

for (const [name, file] of Object.entries(inputs)) {
  test(`parses ${name}`, () => {
    const markdown = readFileSync(file, "utf8");
    const markdownIt = markdownitBlockParser().parse(markdown, {}).map(projectToken);
    const doc = { uri: `file://${file}`, version: 1, getText: () => markdown };
    const tokens = markdownitParser()(doc as never).map(projectQToken);
    assertSnapshot(
      path.join(__dirname, "snapshots", `${name}.json`),
      JSON.stringify({ markdownIt, tokens }, null, 2) + "\n"
    );
  });
}
