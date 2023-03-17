/*
* attrs.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const attrs = markdownItExtension({
  id: '@dragonstyle/attrs',
  title: 'Markdown Attributes',
  description: 'Use pandoc style markdown attributes text in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/arve0/markdown-it-attrs',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Attributes': `# Hello {#id .class attr=value}`
  },
  plugin: async () => {
    const plugin = await import(
      'markdown-it-attrs'
    );
    return [plugin.default];
  }
});

