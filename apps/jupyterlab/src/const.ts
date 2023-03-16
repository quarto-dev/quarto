/*
* const.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { Token } from '@lumino/coreutils';
import { MarkdownItManager } from "./types";


// The namespace for this project
export const kPackageNamespace = 'jupyter_quarto';

// The MarkdownIt manager token.
export const kMarkdownItMgr = new Token<MarkdownItManager>(kPackageNamespace);
