/*
 * index.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 * Copyright (c) 2016-2020 ParkSB.
 */

import type { MarkdownIt } from 'markdown-it';
import type { RendererContext } from 'vscode-notebook-renderer';

import { extendMarkdownIt } from "./extend";
import mermaidPlugin from "./mermaid";

// styles.css sits next to whichever chunk this module ends up in
// (index.js, or a hashed chunk such as index-<hash>.js)
const styleHref = import.meta.url.replace(/[^/]*$/, 'styles.css');

interface MarkdownItRenderer {
	extendMarkdownIt(fn: (md: MarkdownIt) => void): void;
  renderOutputItem: (x: unknown, y: unknown) => unknown;
}

export async function activate(ctx: RendererContext<void>) {
	const markdownItRenderer = await ctx.getRenderer('vscode.markdown-it-renderer') as MarkdownItRenderer | undefined;
	
  if (!markdownItRenderer) {
		throw new Error(`Could not load 'quarto.markdown-it.qmd-extension'`);
	}

  // Check whether this is a dark theme
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  // The shared stylesheet
  const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.classList.add('markdown-style');
	link.href = styleHref;

  // Inline styles
  const style = document.createElement('style');
	style.textContent = isDark ? `
  .callout-title-container  {
    color: var(--vscode-titleBar-activeBackground) !important;
  }
  ` : "";

  const styleTemplate = document.createElement('template');
	styleTemplate.classList.add('markdown-style');
	styleTemplate.content.appendChild(style);
	styleTemplate.content.appendChild(link);
	document.head.appendChild(styleTemplate);

	markdownItRenderer.extendMarkdownIt((md: MarkdownIt) => {
    extendMarkdownIt(md, (md) => mermaidPlugin(md, { dark: isDark }));
	});
}
