/*
 * engine.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import * as vscode from "vscode";

import { Parser, Document, QuartoContext, Token, markdownitParser } from "quarto-core";
import { Range, Position } from "vscode-languageserver-types";

export class MarkdownEngine {
  
  private readonly parser_: Parser;

  public constructor(_context: QuartoContext, _resourcesDir: string) {
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
        return document.getText();
      },
      positionAt(offset: number): Position {
        return document.positionAt(offset);
      }
    };
    return this.parser_(doc);
  }

  
}
