/*
* sub.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const sub = markdownItExtension({
  id: '@dragonstyle/sub',
  title: 'Subscript Text',
  description: 'Use subscript text in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/markdown-it/markdown-it-sub',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Subscript': `H~2~0`
  },
  plugin: async () => {
    const plugin = await import(
      'markdown-it-sub'
    );
    return [plugin.default];
  }
});

