/*
* deflist.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const deflist = markdownItExtension({
  id: '@dragonstyle/deflist',
  title: 'Definition Lists',
  description: 'Use definition lists in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/markdown-it/markdown-it-deflist',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Definition List': `
    Term 1
    :  This is the definition of this term
`
  },
  plugin: async () => {
    const plugin = await import(
      'markdown-it-deflist'
    );
    return [plugin.default];
  }
});

