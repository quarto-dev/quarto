/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { divPlugin } from "../plugins/divs";
import { markdownItExtension } from "./provider";

export const divs = markdownItExtension({
  id: '@quarto/divs',
  title: 'Pandoc fenced divs',
 plugin: async () => {
    return [divPlugin];
  }
});