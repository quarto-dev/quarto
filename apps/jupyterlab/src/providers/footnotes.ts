/*
* footnotes.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const footnotes = markdownItExtension({
  id: '@quarto/footnotes',
  title: 'Footnotes',
  plugin: async () => {
    const footnotePlugin = await import(
      'markdown-it-footnote'
    );
    return [footnotePlugin.default];
  }
});

