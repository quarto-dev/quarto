/*
 * codeview.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";

import {
  CodeViewServer,
  kCodeViewGetCompletions,
  kCodeViewExecute,
  kCodeViewPreviewDiagram,
  kCodeViewAssist,
  kCodeViewGetDiagnostics
} from "editor-types";



export function codeViewServerMethods(server: CodeViewServer): Record<string, JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kCodeViewAssist]: args => server.codeViewAssist(args[0]),
    [kCodeViewExecute]: args => server.codeViewExecute(args[0], args[1]),
    [kCodeViewGetCompletions]: args => server.codeViewCompletions(args[0]),
    [kCodeViewGetDiagnostics]: args => server.codeViewDiagnostics(args[0]),
    [kCodeViewPreviewDiagram]: args => server.codeViewPreviewDiagram(args[0], args[1])
  };
  return methods;
}
