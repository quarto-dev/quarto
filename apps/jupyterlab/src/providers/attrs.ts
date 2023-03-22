/*
* attrs.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const attrs = markdownItExtension({
  id: '@quarto/attributes',
  title: 'Markdown Attributes',
  plugin: async () => {
    const plugin = await import(
      'markdown-it-attrs'
    );
    return [plugin.default];
  }
});

