/*
* gridtables.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import gridTableRulePlugin from '../plugins/gridtables';
import { markdownItExtension } from './provider';

export const gridtables = markdownItExtension({
  id: '@dragonstyle/gridtables',
  title: 'Grid Tables',
  description: 'Use grid tables in markdown cells.',
  documentationUrls: {
    Plugin: 'https://github.com/basverweij/markdown-it-gridtables/tree/develop/src',
    MarkdownIt: 'https://markdown-it.github.io'
  },
  examples: {
    'Grid Tables': `
+---------------+---------------+--------------------+
| Fruit         | Price         | Advantages         |
+===============+===============+====================+
| Bananas       | $1.34         | - built-in wrapper |
|               |               | - bright color     |
+---------------+---------------+--------------------+
| Oranges       | $2.10         | - cures scurvy     |
|               |               | - tasty            |
+---------------+---------------+--------------------+
`
  },
  plugin: async () => {
    return [gridTableRulePlugin];
  }
});

