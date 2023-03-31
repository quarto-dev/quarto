/*
* table-captions.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { tableCaptionPlugin } from '../plugins/table-captions';
import { markdownItExtension } from './provider';

export const tableCaptions = markdownItExtension({
  id: '@quarto/tableCaptions',
  title: 'Quarto Table Captions',
  plugin: async () => {
    return [tableCaptionPlugin];
  }
});
