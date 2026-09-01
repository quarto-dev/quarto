/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * xref.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import path from "node:path";

import { JsonRpcServerMethod } from "core";
import { 
  kXRefIndexForFile, 
  kXRefQuartoIndexForFile, 
  kXRefQuartoXRefForId, 
  kXRefXRefForId, 
  XRefs, 
  XRefServer 
} from "editor-types";
import { projectDirForDocument, } from "quarto-core";
import { xrefsForFile } from "../core/xref";
import { EditorServerOptions } from "./server";

export function xrefServer(options: EditorServerOptions) : XRefServer {
  return {
    async quartoIndexForFile(file: string) : Promise<XRefs> {
      const projectDir = projectDirForDocument(file);
      const refs = await xrefsForFile(
        options.quartoContext, 
        file,
        options.documents, 
        projectDir
      );
      return {
        baseDir: projectDir || path.dirname(file),
        refs
      }
    },
    async quartoXrefForId(file: string, id: string) : Promise<XRefs> {
      const index = await this.quartoIndexForFile(file);
      index.refs = index.refs.filter(ref => {
        return id === `${ref.type}-${ref.id}${ref.suffix}`;
      });
      return index;
    },
    
    // bookdown xrefs, we don't implement these
    indexForFile(file: string) : Promise<XRefs> {
      throw new Error("not implemented");
    },
    xrefForId(file: string, id: string) : Promise<XRefs> {
      throw new Error("not implemented");
    },
  }
}

export function xrefServerMethods(options: EditorServerOptions) : Record<string, JsonRpcServerMethod> {
  const server = xrefServer(options);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kXRefIndexForFile]: args => server.indexForFile(args[0]),
    [kXRefXRefForId]: args => server.xrefForId(args[0], args[1]),
    [kXRefQuartoIndexForFile]: args => server.quartoIndexForFile(args[0]),
    [kXRefQuartoXRefForId]: args => server.quartoXrefForId(args[0], args[1])
  }
  return methods;
}
