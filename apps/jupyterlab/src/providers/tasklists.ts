/*
* tasklists.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const tasklists = markdownItExtension({
  id: '@dragonstyle/tasklists',
  title: 'Task Lists',
  description: 'Use task lists in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/revin/markdown-it-task-lists',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Task List': `
- [ ] an unchecked task list item
- [x] checked item
`
  },
  plugin: async () => {
    const plugin = await import(
      'markdown-it-task-lists'
    );
    return [plugin.default];
  }
});

