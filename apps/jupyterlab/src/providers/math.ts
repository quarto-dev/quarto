/*
* math.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const mathjax = markdownItExtension({
  id: '@dragonstyle/math',
  title: 'Math',
  description: 'Use math in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/markdown-it/ markdown-it-mathjax3',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Inline': `$\\sqrt{3x-1}+(1+x)^2$`
  },
  plugin: async () => {
    const mathPlugin = await import(
      'markdown-it-mathjax3'
    );
    return [mathPlugin.default];
  }
});

