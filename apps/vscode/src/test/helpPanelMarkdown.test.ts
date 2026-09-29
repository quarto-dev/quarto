/*
 * Snapshot test for the Markdown rendering in the Quarto help panel
 * (hovers and help topics): markdown-it with html, linkify and highlight.js.
 *
 * The HTML snapshot is in src/test/markdown/snapshots/. To update it after an
 * intended change, run `UPDATE_SNAPSHOTS=1 yarn test-vscode` and review the diff.
 */

import * as fs from "fs";
import * as path from "path";
import { TEST_PATH } from "./test-utils";
import { assertSnapshot } from "./snapshot";
import { renderAssistMarkdown } from "../providers/assist/markdown";

const markdownDir = path.join(TEST_PATH, "markdown");

suite("Help panel Markdown", function () {
  test("renders links, code, HTML and tables", function () {
    const markdown = fs.readFileSync(path.join(markdownDir, "help-panel.md"), "utf8");
    assertSnapshot(path.join(markdownDir, "snapshots", "help-panel.html"), renderAssistMarkdown(markdown));
  });
});
