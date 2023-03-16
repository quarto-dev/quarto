/*
* sup.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const sup = markdownItExtension({
  id: '@dragonstyle/sup',
  title: 'Superscript Text',
  description: 'Use superscript text in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/markdown-it/markdown-it-sup',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Subscript': `29^th^`
  },
  plugin: async () => {
    const plugin = await import(
      'markdown-it-sup'
    );
    return [plugin.default];
  }
});

