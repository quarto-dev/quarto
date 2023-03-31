/*
* figures.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { figuresPlugin } from '../plugins/figures';
import { markdownItExtension } from './provider';

export const figures = markdownItExtension({
  id: '@quarto/figures',
  title: 'Quarto figures',
  plugin: async () => {
    return [figuresPlugin, { figcaption: true, copyAttrs: true }];
  }
});
