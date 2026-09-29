/*
 * completion-markdown.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Snapshot test for the commonmark rendering of completion item documentation
 * in the visual editor's code cells.
 *
 * The HTML snapshot is in test/snapshots/. To update it after an intended
 * change, run `UPDATE_SNAPSHOTS=1 yarn test` in this directory and review the diff.
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { renderCompletionMarkdown } from "../src/behaviors/completion-markdown";
import { assertSnapshot } from "./snapshot";

test("renders completion documentation", () => {
  const markdown = readFileSync(path.join(__dirname, "fixtures", "completion-docs.md"), "utf8");
  assertSnapshot(path.join(__dirname, "snapshots", "completion-docs.html"), renderCompletionMarkdown(markdown));
});
