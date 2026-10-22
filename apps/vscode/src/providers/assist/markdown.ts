/*
 * markdown.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import MarkdownIt from "markdown-it";
import markdownItHljs from "markdown-it-highlightjs";

// Renders the Markdown shown in the Quarto help panel (hovers and help topics)
export function renderAssistMarkdown(markdown: string): string {
  const md = new MarkdownIt("default", {
    html: true,
    linkify: true,
  });
  const validateLink = md.validateLink.bind(md);
  md.validateLink = (link: string) => {
    return (
      validateLink(link) ||
      link.startsWith("vscode-resource:") ||
      link.startsWith("file:") ||
      /^data:image\/.*?;/.test(link)
    );
  };
  md.use(markdownItHljs, {
    auto: true,
    code: true,
  });
  return md.render(markdown);
}
