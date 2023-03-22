/*
* sub.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const sub = markdownItExtension({
  id: '@quarto/sub',
  title: 'Subscript Text',
  plugin: async () => {
    const plugin = await import(
      'markdown-it-sub'
    );
    return [plugin.default];
  }
});

