/*
 * completion-markdown.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import MarkdownIt from "markdown-it";

const commonmark = new MarkdownIt("commonmark");

// Renders the Markdown documentation of a completion item to HTML
export function renderCompletionMarkdown(markdown: string): string {
  return commonmark.render(markdown);
}
