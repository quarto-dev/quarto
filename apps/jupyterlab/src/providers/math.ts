/*
* math.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const mathjax = markdownItExtension({
  id: '@quarto/mathjax3',
  title: 'Math',
  plugin: async () => {
    const mathPlugin = await import(
      'markdown-it-mathjax3'
    );
    return [mathPlugin.default];
  }
});

