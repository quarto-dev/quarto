/*
 * hover-math.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016 James Yu
 */

import { Hover, MarkupContent, MarkupKind, Position } from "vscode-languageserver";

import { MathjaxTypesetOptions } from "editor-types";
import { mathjaxTypeset } from "editor-server";

import { Document, Parser, mathRange } from "quarto-core";
import { LsConfiguration } from "../../config";


export function mathHover(parser: Parser, doc: Document, pos: Position, config?: LsConfiguration | undefined): Hover | null {
  const range = mathRange(parser, doc, pos);
  if (range) {
    const contents = mathjaxTypesetToMarkdown(range.math, doc.getText(), config);
    if (contents) {
      return {
        contents,
        range: range.range,
      };
    }
  }
  return null;
}


function mathjaxTypesetToMarkdown(
  tex: string,
  docText: string,
  config?: LsConfiguration | undefined
): MarkupContent | null {
  const options: MathjaxTypesetOptions = {
    format: "data-uri",
    theme: config?.colorTheme || "dark",
    scale: config?.mathjaxScale || 1,
    extensions: config?.mathjaxExtensions || []
  }
  const result = mathjaxTypeset(tex, options, docText);
  if (result.math) {
    return {
      kind: MarkupKind.Markdown,
      value: `![equation](${result.math})`,
    };
  } else {
    return {
      kind: MarkupKind.Markdown,
      value: `**LaTeX Error**:\n" + ${result.error || "Unknown error"}`,
    };
  }
}
