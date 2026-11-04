/*
 * codeview.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";

import {
  CodeViewServer,
  kCodeViewGetCompletions,
  kCodeViewExecute,
  kCodeViewPreviewDiagram,
  kCodeViewAssist,
  kCodeViewGetDiagnostics,
  kCodeViewGetColorTheme,
  kCodeViewGetLanguages,
  kCodeViewGetGrammar,
  kCodeViewGetEditorFont
} from "editor-types";



export function codeViewServerMethods(server: CodeViewServer): Record<string, JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kCodeViewAssist]: args => server.codeViewAssist(args[0]),
    [kCodeViewExecute]: args => server.codeViewExecute(args[0], args[1]),
    [kCodeViewGetCompletions]: args => server.codeViewCompletions(args[0]),
    [kCodeViewGetDiagnostics]: args => server.codeViewDiagnostics(args[0]),
    [kCodeViewPreviewDiagram]: args => server.codeViewPreviewDiagram(args[0], args[1]),
    [kCodeViewGetColorTheme]: args => server.codeViewColorTheme(args[0]),
    [kCodeViewGetLanguages]: () => server.codeViewLanguages(),
    [kCodeViewGetGrammar]: args => server.codeViewGrammar(args[0]),
    [kCodeViewGetEditorFont]: () => server.codeViewEditorFont()
  };
  return methods;
}
