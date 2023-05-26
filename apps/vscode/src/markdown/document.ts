/*
 * document.ts
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

import { isFrontMatter, parseFrontMatterStr } from "quarto-core";
import { MarkdownEngine } from "./engine";

export interface MarkdownTextLine {
  text: string;
}

export interface MarkdownTextDocument {
  readonly uri: vscode.Uri;
  readonly version: number;
  readonly lineCount: number;

  lineAt(line: number): MarkdownTextLine;
  getText(): string;
}

export async function documentFrontMatterYaml(
  engine: MarkdownEngine,
  doc: vscode.TextDocument
) {
  const tokens = engine.parse(doc);
  const yaml = tokens.find(isFrontMatter);
  if (yaml) {
    return yaml.data;
  } else {
    return '';
  }
}

export async function documentFrontMatter(
  engine: MarkdownEngine,
  doc: vscode.TextDocument
): Promise<Record<string, unknown>> {
  const yaml = await documentFrontMatterYaml(engine, doc);
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml);
    if (frontMatter && typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}
