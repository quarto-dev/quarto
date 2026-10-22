/*
 * quarto.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 */

import { Position } from "vscode-languageserver-types";

import { Document, filePathForDoc, isQuartoDoc, isQuartoRevealDoc, isQuartoYaml, isQuartoDashboardDoc } from "quarto-core";

import { lines } from "core";

export interface CompletionResult {
  token: string;
  completions: Completion[];
  cacheable: boolean;
}

export interface HoverResult {
  content: string;
  range: { start: Position; end: Position; };
}

export interface Completion {
  type: string;
  value: string;
  display?: string;
  description?: string;
  suggest_on_accept?: boolean;
  replace_to_end?: boolean;
}

export interface EditorContext {
  path: string;
  filetype: string;
  embedded: boolean;
  line: string;
  code: string;
  position: {
    row: number;
    column: number;
  };
  explicit: boolean;
  trigger?: string;
  formats: string[];
  project_formats: string[];
  engine: string;
  client: string;
}

export const kContextHeading = "heading";
export const kContextDiv = "div";
export const kContextDivSimple = "div-simple";
export const kContextCodeblock = "codeblock";
export const kContextFigure = "figure";

export type AttrContext =
  | "heading"
  | "div"
  | "div-simple"
  | "codeblock"
  | "figure";

export interface AttrToken {
  line: string;
  context: AttrContext;
  attr: string;
  token: string;
}

export function codeEditorContext(
  path: string,
  filetype: string,
  code: string,
  pos: Position,
  embedded: boolean,
  explicit?: boolean,
  trigger?: string
): EditorContext {
  const line = lines(code)[pos.line];
  const position = { row: pos.line, column: pos.character };

  // detect reveal document
  const formats: string[] = [];
  if (isQuartoRevealDoc(code)) {
    formats.push("revealjs");
  }
  if (isQuartoDashboardDoc(code)) {
    formats.push("dashboard");
  }

  return {
    path,
    filetype,
    embedded,
    line,
    code,
    position,
    explicit: !!explicit,
    trigger,
    formats,
    project_formats: [],
    engine: "jupyter",
    client: "lsp",
  };
}

export function docEditorContext(
  doc: Document,
  pos: Position,
  explicit: boolean,
  trigger?: string
): EditorContext {
  const path = filePathForDoc(doc);
  const filetype = isQuartoDoc(doc)
    ? "markdown"
    : isQuartoYaml(doc)
      ? "yaml"
      : "markdown"; // should never get here

  const code = doc.getText();

  return codeEditorContext(
    path,
    filetype,
    code,
    pos,
    false,
    explicit,
    trigger
  );
}
