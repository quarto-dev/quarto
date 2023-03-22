/*
* tasklists.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const tasklists = markdownItExtension({
  id: '@quarto/tasklists',
  title: 'Task Lists',
  plugin: async () => {
    const plugin = await import(
      'markdown-it-task-lists'
    );
    return [plugin.default];
  }
});

