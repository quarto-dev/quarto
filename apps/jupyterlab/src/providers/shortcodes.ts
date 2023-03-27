/*
* shortcodes.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { shortcodePlugin } from '../plugins/shortcodes';
import { markdownItExtension } from './provider';

export const shortcodes = markdownItExtension({
  id: '@quarto/shortcode',
  title: 'Shortcodes',
  plugin: async () => {
    return [shortcodePlugin];
  }
});
