/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { calloutPlugin } from "../plugins/callouts";
import { markdownItExtension } from "./provider";

export const callouts = markdownItExtension({
  id: '@dragonstyle/markdown-it-quarto-callouts',
  title: 'Quarto callouts',
  description: 'Create callouts using Quarto syntax.',
  documentationUrls: {
    Plugin: 'https://github.com/quarto-dev/quarto',
  },
  examples: {
    'Note': `
:::{.callout-note}

## Callout Title

The text content of the callout.

:::
`
  },
  plugin: async () => {
    return [calloutPlugin];
  }
});