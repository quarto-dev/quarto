/*
 * path.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import * as path from 'path';
import { URI, Utils } from 'vscode-uri';
import { Schemes } from './schemes';

export function isParentDir(parent: URI, maybeChild: URI): boolean {
  if (parent.scheme === maybeChild.scheme && parent.authority === maybeChild.authority) {
    const relative = path.relative(parent.path, maybeChild.path);
    return !relative.startsWith('..');
  }
  return false;
}

export function computeRelativePath(fromDoc: URI, toDoc: URI, preferDotSlash = false): string | undefined {
  if (fromDoc.scheme === toDoc.scheme && fromDoc.scheme !== Schemes.untitled) {
    const rootDir = Utils.dirname(fromDoc);
    let newLink = path.posix.relative(rootDir.path, toDoc.path);
    if (preferDotSlash && !(newLink.startsWith('../') || newLink.startsWith('..\\'))) {
      newLink = './' + newLink;
    }
    return newLink;
  }

  return undefined;
}
