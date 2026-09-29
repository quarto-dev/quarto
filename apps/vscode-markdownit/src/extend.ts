/*
 * extend.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import type { MarkdownIt } from 'markdown-it';

import attrPlugin from "markdown-it-attrs";
import footnotes from "markdown-it-footnote";
import deflistPlugin from "markdown-it-deflist";
import subPlugin from "markdown-it-sub";
import supPlugin from 'markdown-it-sup';
import taskListPlugin from 'markdown-it-task-lists';

import { figuresPlugin } from 'core';
import { figureDivsPlugin } from 'core';
import { tableCaptionPlugin } from 'core';
import { spansPlugin } from 'core';
import { citationPlugin } from 'core';
import { divPlugin } from 'core';
import { calloutPlugin } from 'core';
import { decoratorPlugin } from 'core';
import { gridTableRulePlugin } from 'core';
import { shortcodePlugin } from 'core';
import { yamlPlugin } from 'core';

// Extends the host's markdown-it instance (VS Code's or Positron's notebook
// markdown renderer) with Quarto's syntax. The Mermaid plugin is passed in
// because it renders through the DOM; this keeps the rest testable in Node.
export function extendMarkdownIt(md: MarkdownIt, mermaidPlugin: (md: MarkdownIt) => void) {
  const render = md.render.bind(md);
  md.render = (src: string, env?: Record<string, unknown>) => {

    // Do any text based transformations before the markdown is rendered

    // Ensure that there are new lines at end divs
    src = src.replace(kCloseDivNoBlock, `$1\n\n$2`);
    return render(src, env);
  }

  return md.use(footnotes)
           .use(spansPlugin)
           .use(attrPlugin, {})
           .use(deflistPlugin)
           .use(figuresPlugin, {})
           .use(gridTableRulePlugin)
           .use(subPlugin)
           .use(supPlugin)
           .use(taskListPlugin)
           .use(divPlugin)
           .use(figureDivsPlugin)
           .use(tableCaptionPlugin)
           .use(citationPlugin)
           .use(mermaidPlugin) // TODO: mermaid breaks other plugins
           .use(calloutPlugin)
           .use(decoratorPlugin)
           .use(yamlPlugin)
           .use(shortcodePlugin);
}

const kCloseDivNoBlock = /([^\s])\n(:::+(?:\{.*\})?)/gm;
