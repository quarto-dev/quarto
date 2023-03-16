/*
* deflist.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const figures = markdownItExtension({
  id: '@dragonstyle/implicit-figures',
  title: 'Implicit Figures',
  description: 'Use implicit figures in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/arve0/markdown-it-implicit-figures',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Implicit Figure': `
    ![](fig.png)
`
  },
  plugin: async () => {
    const options = {
      figcaption: true,
    };


    const plugin = await import(
      'markdown-it-implicit-figures'
    );
    return [plugin.default, options];
  }
});

