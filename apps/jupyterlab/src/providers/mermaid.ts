/*
* mermaid.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { markdownItExtension } from './provider';

export const mermaid = markdownItExtension(
  {id: '@dragonstyle/markdown-it-mermaid',
  title: 'Mermaid',
  description: 'Create diagrams and visualizations using text and code.',
  documentationUrls: {
    Plugin: 'https://github.com/agoose77/markdown-it-mermaid',
    MermaidJS: 'https://mermaid-js.github.io/mermaid'
  },
  examples: {
    'Mermaid Flowchart': `
  \`\`\`mermaid
  graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
  \`\`\``
  },
  plugin: async () => {
    const mermaidPlugin = await import(
      '@agoose77/markdown-it-mermaid'
    );
    return [mermaidPlugin.default];
  }}
);


