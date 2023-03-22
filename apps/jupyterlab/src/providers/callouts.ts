/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { calloutPlugin } from "../plugins/callouts";
import { markdownItExtension } from "./provider";

export const callouts = markdownItExtension({
  id: '@quarto/callouts',
  title: 'Quarto callouts',
  plugin: async () => {
    return [calloutPlugin];
  }
});