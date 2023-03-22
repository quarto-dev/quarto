/*
* gridtables.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import gridTableRulePlugin from '../plugins/gridtables';
import { markdownItExtension } from './provider';

export const gridtables = markdownItExtension({
  id: '@quarto/gridtables',
  title: 'Grid Tables',
  plugin: async () => {
    return [gridTableRulePlugin];
  }
});

