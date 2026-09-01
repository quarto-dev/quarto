/*
 * resource.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { EditorUIContext } from "./ui-types";

// mapResourceToURL can return a string or promise, this function
// normalizes the call so its always a promise
export function mapResourceToURL(uiContext: EditorUIContext, path: string) : Promise<string> {
  return new Promise(resolve => {
    const result = uiContext.mapResourceToURL(path);
    if (typeof(result) === "string") {
      resolve(result);
    } else {
      result.then(resolve);
    }
  });

}