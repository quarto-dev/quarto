/*
* sup.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const sup = markdownItExtension({
  id: '@quarto/sup',
  title: 'Superscript Text',
  plugin: async () => {
    const plugin = await import(
      'markdown-it-sup'
    );
    return [plugin.default];
  }
});

