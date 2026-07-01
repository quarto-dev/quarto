/*
 * server.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as fs from "node:fs";

import { EditorServer } from "editor-types";

import { crossrefServer, crossrefServerMethods, CrossrefServerOptions } from "./crossref";
import { dataCiteServer, dataCiteServerMethods } from "./datacite";
import { doiServer, doiServerMethods } from "./doi";
import { pandocServer, pandocServerMethods } from "./pandoc";
import { pubMedServer, pubMedServerMethods, PubMedServerOptions } from "./pubmed";
import { xrefServer, xrefServerMethods } from "./xref";
import { zoteroServer, zoteroServerMethods } from "./zotero";
import { JsonRpcServerMethod } from 'core';
import { QuartoContext } from "quarto-core";
import { EditorServerDocuments, PandocServerOptions } from "../core";


export interface EditorServerOptions {
  quartoContext: QuartoContext;
  pandoc: PandocServerOptions;
  pubmed: PubMedServerOptions;
  crossref: CrossrefServerOptions;
  documents: EditorServerDocuments;
}

export function defaultEditorServerOptions(
  quartoContext: QuartoContext,
  resourcesDir: string, 
  pandocPath?: string,
  payloadLimitMb = 100
) : EditorServerOptions {
  return {
    quartoContext,
    pandoc: {
      resourcesDir,
      pandocPath: pandocPath || "pandoc",
      payloadLimitMb
    },
    pubmed: {
      tool: "Quarto",
      email: "pubmed@rstudio.com"
    },
    crossref: {
      userAgent: "Quarto",
      email: "crossref@rstudio.com"
    },
    documents: fsEditorServerDocuments()
  }
}

export function fsEditorServerDocuments() {
  return {
    getDocument(filePath: string) {
      const lastModified = fs.statSync(filePath).mtime;
      return {
        filePath,
        code: fs.readFileSync(filePath, { encoding: "utf-8" }),
        lastModified
      }
    }
  }
}

export function editorServer(options: EditorServerOptions) : EditorServer {
  return {
    pandoc: pandocServer(options),
    doi: doiServer(),
    crossref: crossrefServer(options.crossref),
    datacite: dataCiteServer(),
    pubmed: pubMedServer(options.pubmed),
    xref: xrefServer(options),
    zotero: zoteroServer(),
    environment: undefined
  };
}

export function editorServerMethods(options: EditorServerOptions): Record<string,JsonRpcServerMethod> {
  return {
    ...pandocServerMethods(options),
    ...doiServerMethods(),
    ...crossrefServerMethods(options.crossref),
    ...dataCiteServerMethods(),
    ...pubMedServerMethods(options.pubmed),
    ...zoteroServerMethods(),
    ...xrefServerMethods(options)
  }
}
