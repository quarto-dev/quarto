/*
* deflist.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const deflist = markdownItExtension({
  id: '@quarto/deflist',
  title: 'Definition Lists',
  plugin: async () => {
    const plugin = await import(
      'markdown-it-deflist'
    );
    return [plugin.default];
  }
});

