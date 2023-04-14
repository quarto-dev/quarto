/*
* index.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { MarkdownItManager } from './types';
import { mermaid } from './providers/mermaid';
import { kMarkdownItMgr, kPackageNamespace } from './const';
import { footnotes } from './providers/footnotes';

import '../style/index.css';
import { markdownItManager } from './manager';
import { divs } from './providers/divs';
import { deflist } from './providers/deflist';
import { gridtables } from './providers/gridtables';
import { sub } from './providers/sub';
import { sup } from './providers/sup';
import { tasklists } from './providers/tasklists';
import { cites } from './providers/cites';
import { attrs } from './providers/attrs';
import { callouts } from './providers/callouts';
import { decorator } from './providers/decorator';
import { yaml } from './providers/yaml';
import { math } from './providers/math';
import { figures } from './providers/figures';
import { figureDivs } from './providers/figure-divs';
import { tableCaptions } from './providers/table-captions';
import { spans } from './providers/spans';
import { shortcodes } from './providers/shortcodes';

const plugin: JupyterFrontEndPlugin<MarkdownItManager> = {
  id: `${kPackageNamespace}:plugin`,
  autoStart: true,
  provides: kMarkdownItMgr,
  activate: (_app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab-quarto is activated!');

    // Create a markdown rendering manager 
    return markdownItManager();
  }
};

// Markdown It Extensions which provide base Pandoc behavior
const kPandocExtensions = [
  footnotes, // footnote seriously render in the cell in which they appear in :(
  spans,
  attrs,
  deflist,
  figures,
  gridtables,
  sub,
  sup,
  tasklists,
  divs,
  math
];

// Markdown It Extensions which provide Quarto specific behavior
const kQuartoExtensions = [
  figureDivs,
  tableCaptions,
  cites,
  mermaid,
  callouts,
  decorator,
  yaml,
  shortcodes
];


// The extensions that should be enabled for Jupyter
export default [plugin, ...kPandocExtensions, ...kQuartoExtensions ];
