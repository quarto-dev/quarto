/*
 * math.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";
import { kMathMathjaxTypesetSvg, MathjaxTypesetOptions, MathServer } from "editor-types";

import { mathjaxTypeset } from "../core/mathjax";
import { EditorServerDocuments } from "../core";

export function mathServer(documents: EditorServerDocuments) : MathServer {
  return {
    async mathjaxTypeset(tex: string, options: MathjaxTypesetOptions, docPath: string | null) {
      const docText = docPath ? documents.getDocument(docPath).code : undefined;
      return mathjaxTypeset(tex, options, docText);
    },
  };
}

export function mathServerMethods(documents: EditorServerDocuments) : Record<string, JsonRpcServerMethod> {
  const server = mathServer(documents);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kMathMathjaxTypesetSvg]: args => server.mathjaxTypeset(args[0], args[1], args[2]),
  }
  return methods;
}

