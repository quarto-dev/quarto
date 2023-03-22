/*
* headings.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { headingsPlugin } from "../plugins/headings";
import { markdownItExtension } from "./provider";

export const headings = markdownItExtension({
  id: '@quarto/heading',
  title: 'Headings',
  plugin: async () => {
    return [headingsPlugin];
  }
});