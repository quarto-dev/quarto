/*
* mermaid.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import mermaidPlugin from '../plugins/mermaid';
import { markdownItExtension } from './provider';

export const mermaid = markdownItExtension(
  {id: '@dragonstyle/markdown-it-mermaid',
  title: 'Mermaid',
  description: 'Create diagrams and visualizations using text and code.',
  documentationUrls: {
    MermaidJS: 'https://mermaid-js.github.io/mermaid'
  },
  examples: {
    'Mermaid Flowchart': `
\`\`\`{mermaid}
flowchart LR
  A[Hard edge] --> B(Round edge)
  B --> C{Decision}
  C --> D[Result one]
  C --> E[Result two]
\`\`\``
  },
  plugin: async () => {
    return [mermaidPlugin];
  }}
);


