/*
 * engine.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import * as vscode from "vscode";

import { Parser, Document, QuartoContext, Token, markdownitParser } from "quarto-core";
import { Range, Position } from "vscode-languageserver-types";

export class MarkdownEngine {

  private readonly parser_: Parser;

  public constructor() {
    this.parser_ = markdownitParser();
  }

  public parse(document: vscode.TextDocument): Token[] {
    const doc: Document = {
      get uri() { return document.uri.toString(); },
      get $uri() { return document.uri; },
      get languageId() { return document.languageId; },
      get version() { return document.version; },
      get lineCount() { return document.lineCount; },
      getText(range?: Range | undefined): string {
        const r = range ? new vscode.Range(
          range.start.line,
          range.start.character,
          range.end.line,
          range.end.character
        ) : undefined;
        return document.getText(r);
      },
      positionAt(offset: number): Position {
        return document.positionAt(offset);
      }
    };
    return this.parser_(doc);
  }


}
