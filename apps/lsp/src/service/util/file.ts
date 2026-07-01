/*
 * file.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as path from 'path';
import { URI, Utils } from 'vscode-uri';
import { LsConfiguration } from '../config';

export function looksLikeMarkdownUri(config: LsConfiguration, resolvedHrefPath: URI): boolean {
  return looksLikeMarkdownExt(config, Utils.extname(resolvedHrefPath));
}

export function looksLikeMarkdownFilePath(config: LsConfiguration, fileName: string): boolean {
  return looksLikeMarkdownExt(config, path.extname(fileName));
}

function looksLikeMarkdownExt(config: LsConfiguration, rawExt: string): boolean {
  return config.markdownFileExtensions.includes(rawExt.toLowerCase().replace('.', ''));
}
