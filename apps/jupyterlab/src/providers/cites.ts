/*
* cites.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { citationPlugin } from "../plugins/cites";
import { markdownItExtension } from "./provider";

export const cites = markdownItExtension({
  id: '@quarto/cites',
  title: 'Citations',
  plugin: async () => {
    return [citationPlugin];
  }
});