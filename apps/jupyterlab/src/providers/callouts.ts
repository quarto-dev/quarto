/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { pandocDivs } from "../plugins/callout";
import { markdownItExtension } from "./provider";

export const callouts = markdownItExtension({
  id: '@dragonstyle/markdown-it-quarto-callout',
  title: 'Quarto callout',
  description: 'Create callouts using Quarto syntax.',
  documentationUrls: {
    Plugin: 'https://github.com/dragonstyle/mdit-quarto-callout',
  },
  examples: {
    'Note': `
  :::{.callout-note}
  
  ## The Title of the Callout

  This is a callout which notes something for the reader.

  :::
  `
  },
  plugin: async () => {
    return [pandocDivs];
  }
});