/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { divPlugin } from "../plugins/divs";
import { markdownItExtension } from "./provider";

export const divs = markdownItExtension({
  id: '@dragonstyle/markdown-it-quarto-callout',
  title: 'Pandoc style divs',
  description: 'Create divs using Pandoc syntax.',
  documentationUrls: {
    Plugin: 'https://github.com/dragonstyle/mdit-quarto-callout',
  },
  examples: {
    'Fenced Div': `
  :::{#div-id .div-class div-attr=bar}
  
  This is the body content of the div.

  :::
  `
  },
  plugin: async () => {
    return [divPlugin];
  }
});