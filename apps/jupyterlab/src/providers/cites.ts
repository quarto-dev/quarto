/*
* citations.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { citationPlugin } from "../plugins/cites";
import { markdownItExtension } from "./provider";

export const cites = markdownItExtension({
  id: '@dragonstyle/markdown-it-quarto-citation',
  title: 'Quarto citations',
  description: 'Create citations using Quarto syntax.',
  documentationUrls: {
    Plugin: 'https://github.com/dragonstyle/mdit-quarto-citation',
  },
  examples: {
    'Citation': `@knuth1984`
  },
  plugin: async () => {
    return [citationPlugin];
  }
});