/*
* spans.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { spansPlugin } from "../plugins/spans";
import { markdownItExtension } from "./provider";

export const spans = markdownItExtension({
  id: '@quarto/spans',
  title: 'Pandoc bracketed spans',
  plugin: async () => {
    return [spansPlugin];
  },
});
