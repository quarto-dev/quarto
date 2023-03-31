/*
* figure-divs.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { figureDivsPlugin } from '../plugins/figure-divs';
import { markdownItExtension } from './provider';

export const figureDivs = markdownItExtension({
  id: '@quarto/figureDivs',
  title: 'Quarto Figure Divs',
  plugin: async () => {
    return [figureDivsPlugin];
  }
});
