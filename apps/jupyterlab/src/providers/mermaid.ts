/*
* mermaid.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import mermaidPlugin from '../plugins/mermaid';
import { markdownItExtension } from './provider';

export const mermaid = markdownItExtension(
  {id: '@quarto/mermaid',
  title: 'Mermaid',
  plugin: async () => {
    // Figure out whether this is dark mode
    const isDark = document.body.getAttribute("data-jp-theme-light") === "false";

    return [mermaidPlugin, { dark: isDark }];
  }}
);


