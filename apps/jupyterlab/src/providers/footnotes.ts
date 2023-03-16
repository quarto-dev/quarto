/*
* footnotes.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const footnotes = markdownItExtension({
  id: '@dragonstyle/footnote',
  title: 'Footnotes',
  description: 'Use footnotes in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/markdown-it/markdown-it-footnote',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Footnote': `
    Here is a footnote reference,[^1]

    [^1]: Here is the footnote.
    `
  },
  plugin: async () => {
    const footnotePlugin = await import(
      'markdown-it-footnote'
    );
    return [footnotePlugin.default];
  }
});

