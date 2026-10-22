/*
 * codeviews.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { CompletionList, Range } from "vscode-languageserver-types";
import { DiagramState } from "./diagram";

export const kCodeViewAssist = 'code_view_assist';
export const kCodeViewGetCompletions = 'code_view_get_completions';
export const kCodeViewExecute = 'code_view_execute';
export const kCodeViewPreviewDiagram = 'code_view_preview_diagram';
/**
 * for calling [`codeViewDiagnostics` in custom.ts](../../../apps/lsp/src/custom.ts)
 */
export const kCodeViewGetDiagnostics = 'code_view_get_diagnostics';

export type CodeViewExecute = "selection" | "cell" | "cell+advance" | "above" | "below";

export type CodeViewBlock = { pos: number, language: string, code: string; active: boolean; };
export interface CodeViewActiveBlockContext {
  activeLanguage: string;
  blocks: Array<CodeViewBlock>;
  selection: Range;
  selectedText: string;
}

export type CodeViewSelectionAction = "nextline" | "nextblock" | "prevblock" | { line: number, character: number; };

export interface CodeViewCellContext {
  filepath: string;
  language: string;
  code: string[];
  cellBegin: number;
  cellEnd: number;
  selection: Range;
}

export const kStartRow = "start.row";
export const kStartColumn = "start.column";
export const kEndRow = "end.row";
export const kEndColumn = "end.column";
export interface LintItem {
  [kStartRow]: number;
  [kStartColumn]: number;
  [kEndRow]: number;
  [kEndColumn]: number;
  text: string;
  type: string;
}

export interface CodeViewCompletionContext extends CodeViewCellContext {
  explicit: boolean;
}

/**
 * Constructed by `vscodeCodeViewServer` in [codeview.ts](../../../apps/vscode/src/providers/editor/codeview.ts).
 */
export interface CodeViewServer {
  codeViewAssist: (contxt: CodeViewCellContext) => Promise<void>;
  codeViewExecute: (execute: CodeViewExecute, context: CodeViewActiveBlockContext) => Promise<void>;
  codeViewDiagnostics: (context: CodeViewCellContext) => Promise<LintItem[] | undefined>;
  codeViewCompletions: (context: CodeViewCompletionContext) => Promise<CompletionList>;
  codeViewPreviewDiagram: (state: DiagramState, activate: boolean) => Promise<void>;
}
