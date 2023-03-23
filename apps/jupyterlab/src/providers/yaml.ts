/*
* yaml-block.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownitFrontMatterPlugin } from "../plugins/yaml";
import { markdownItExtension } from "./provider";

export const yaml = markdownItExtension({
  id: '@quarto/yaml',
  title: 'Quarto Yaml',
  plugin: async () => {
    return [markdownitFrontMatterPlugin];
  }
});