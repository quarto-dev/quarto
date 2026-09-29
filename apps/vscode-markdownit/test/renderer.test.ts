/*
 * renderer.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Snapshot tests for the notebook markdown renderer: Quarto's markdown-it
 * extensions (extendMarkdownIt, the same setup activate() installs) applied to
 * a markdown-it instance configured like the host's.
 *
 * The HTML snapshots are in test/snapshots/. To update them after an intended
 * change, run `UPDATE_SNAPSHOTS=1 yarn test` in this directory and review the diff.
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import MarkdownIt from "markdown-it";

import "./mermaid-stub"; // before ../src/mermaid
import { extendMarkdownIt } from "../src/extend";
import mermaidPlugin from "../src/mermaid";
import { assertSnapshot } from "./snapshot";

const testDir = __dirname;
const examplesDir = path.join(testDir, "..", "..", "vscode", "src", "test", "examples");

// VS Code's notebook markdown renderer creates its instance with
// { html: true, linkify: true } before calling extendMarkdownIt.
const render = (src: string) => {
  const md = new MarkdownIt({ html: true, linkify: true });
  extendMarkdownIt(md, (md) => mermaidPlugin(md, { dark: false }));
  return md.render(src, {});
};

const inputs: Record<string, string> = {
  "quarto-syntax": path.join(testDir, "fixtures", "quarto-syntax.qmd"),
  "valid-basics-2": path.join(examplesDir, "valid-basics-2.qmd"),
  "valid-nesting": path.join(examplesDir, "valid-nesting.qmd"),
  "attr-equals": path.join(examplesDir, "attr-equals.qmd"),
  "nested-checked-list": path.join(examplesDir, "nested-checked-list.qmd"),
};

for (const [name, file] of Object.entries(inputs)) {
  test(`renders ${name}`, () => {
    const html = render(readFileSync(file, "utf8"));
    assertSnapshot(path.join(testDir, "snapshots", `${name}.html`), html);
  });
}
