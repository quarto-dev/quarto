/*
 * range.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import * as vscode from "vscode";
import { Range, Position } from "vscode-languageserver-types";

export function vscRange(range: Range) {
  return new vscode.Range(vscPosition(range.start), vscPosition(range.end));
}

export function vscPosition(position: Position) {
  return new vscode.Position(position.line, position.character);
}
