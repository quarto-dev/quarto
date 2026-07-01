/*
 * services.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { CodeViewServer, EditorServices } from "editor-types";

import { mathServer, mathServerMethods } from "./math";
import { dictionaryServer, dictionaryServerMethods, DictionaryServerOptions } from './dictionary';
import { JsonRpcServerMethod } from 'core';
import { prefsServer, prefsServerMethods } from "./prefs";
import { sourceServer, sourceServerMethods } from "./source";
import { PandocServerOptions } from "../core/pandoc";
import { codeViewServerMethods } from "./codeview";
import { EditorServerDocuments } from "../core";

export {
  mathServer, 
  mathServerMethods, 
  dictionaryServer, 
  dictionaryServerMethods,
  prefsServer,
  prefsServerMethods,
  codeViewServerMethods,
  sourceServer,
  sourceServerMethods
};
export type { DictionaryServerOptions };

export interface EditorServicesOptions {
  documents: EditorServerDocuments;
  dictionary: DictionaryServerOptions;
  pandoc: PandocServerOptions,
  codeview?: CodeViewServer;
}

export function editorServices(options: EditorServicesOptions) : EditorServices {
  return {
    math: mathServer(options.documents),
    dictionary: dictionaryServer(options.dictionary),
    prefs: prefsServer(),
    source: sourceServer(options.pandoc),
    codeview: options.codeview
  };
} 

export function editorServicesMethods(options: EditorServicesOptions): Record<string,JsonRpcServerMethod> {
  return {
    ...mathServerMethods(options.documents),
    ...dictionaryServerMethods(options.dictionary),
    ...prefsServerMethods(prefsServer()),
    ...sourceServerMethods(options.pandoc),
    ...(options.codeview ? codeViewServerMethods(options.codeview) : {})
  };
}
