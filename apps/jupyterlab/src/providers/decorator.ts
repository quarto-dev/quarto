/*
* code.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { decoratorPlugin } from "../plugins/decorator";
import { markdownItExtension } from "./provider";

export const decorator = markdownItExtension({
  id: '@quarto/fence',
  title: 'Fenced Code Blocks',
  plugin: async () => {
    return [decoratorPlugin];
  }
});