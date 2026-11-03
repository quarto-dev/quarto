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
export const kCodeViewGetColorTheme = 'code_view_get_color_theme';
export const kCodeViewGetLanguages = 'code_view_get_languages';
export const kCodeViewGetGrammar = 'code_view_get_grammar';
export const kCodeViewGetEditorFont = 'code_view_get_editor_font';

/**
 * The font settings of the vscode source editor (editor.fontFamily etc.)
 */
export interface CodeViewEditorFont {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontLigatures: boolean | string;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * A TextMate token color rule from a VS Code color theme
 */
export interface CodeViewTokenColor {
  name?: string;
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

/**
 * The active VS Code color theme (resolved from the theme's json, including
 * any themes it includes). `colors` are workbench color ids (e.g. "editor.background").
 */
export interface CodeViewColorTheme {
  name: string;
  type: "light" | "dark" | "hcDark" | "hcLight";
  colors: Record<string, string>;
  tokenColors: CodeViewTokenColor[];
}

/**
 * A language contributed by a VS Code extension, along with the TextMate
 * scope of its grammar (if it has one) and its language configuration
 */
export interface CodeViewLanguage {
  id: string;
  aliases: string[];
  extensions: string[];
  scopeName?: string;
  configuration?: unknown;
}

/**
 * The raw contents of a TextMate grammar (json or plist, see `path`)
 */
export interface CodeViewGrammar {
  scopeName: string;
  path: string;
  content: string;
}

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
  codeViewColorTheme: (themeId?: string) => Promise<CodeViewColorTheme | undefined>;
  codeViewLanguages: () => Promise<CodeViewLanguage[]>;
  codeViewGrammar: (scopeName: string) => Promise<CodeViewGrammar | undefined>;
  codeViewEditorFont: () => Promise<CodeViewEditorFont>;
}
