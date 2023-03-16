/*
* provider.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { JupyterFrontEndPlugin  } from '@jupyterlab/application';

import { kMarkdownItMgr, kPackageNamespace } from '../const';
import { MarkdownItManager, MarkdownItPluginProvider } from '../types';

export function markdownItExtension(provider: MarkdownItPluginProvider) {
    return {
        id: `${kPackageNamespace}:${provider.id}`,
        autoStart: true,
        requires: [kMarkdownItMgr],
        activate: (_app, manager: MarkdownItManager) => {
            console.log(`Quarto MarkdownIt plugin ${provider.id} is activated!`);
            manager.registerPlugin(provider);
        }
    } as JupyterFrontEndPlugin<void>;
}



