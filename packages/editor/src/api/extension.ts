/*
 * extension.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { PandocExtensions } from './pandoc';

import { Extension, ExtensionContext, ExtensionFn } from './extension-types'

export type { Extension, ExtensionContext, ExtensionFn } ;

// create an ExtensionFn for a given extension and format option that must be enabled
export function extensionIfEnabled(extension: Extension, name: string | string[]) {
  return (context: ExtensionContext) => {
    if (extensionEnabled(context.pandocExtensions, name)) {
      return extension;
    } else {
      return null;
    }
  };
}

export function extensionEnabled(pandocExtensions: PandocExtensions, name: string | string[]) {
  // match single extension name
  if (typeof name === 'string') {
    if (pandocExtensions[name]) {
      return true;
    }

    // match any one of several names
  } else if (Array.isArray(name)) {
    for (const nm of name) {
      if (pandocExtensions[nm]) {
        return true;
      }
    }
  }

  return false;
}
