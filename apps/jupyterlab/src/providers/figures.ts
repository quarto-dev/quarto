/*
* deflist.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const figures = markdownItExtension({
  id: '@quarto/figures',
  title: 'Figures',
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

