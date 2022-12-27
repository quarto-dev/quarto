/*
 * quarto.ts
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

import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range, CompletionItem } from "vscode-languageserver-types";

import { QuartoContext } from "quarto-core";

import {
  filePathForDoc,
  isQuartoDoc,
  isQuartoRevealDoc,
  isQuartoYaml,
} from "../core/doc";
import { initializeAttrCompletionProvider, AttrToken } from "./quarto-attr";
import { initializeQuartoYamlModule, QuartoYamlModule } from "./quarto-yaml";
import { ExecFileSyncOptions } from "child_process";

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

export function editorContext(
  doc: TextDocument,
  pos: Position,
  explicit: boolean,
  trigger?: string
) {
  const path = filePathForDoc(doc);
  const filetype = isQuartoDoc(doc)
    ? "markdown"
    : isQuartoYaml(doc)
    ? "yaml"
    : "markdown"; // should never get here
  const embedded = false;
  const code = doc.getText();
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line, code.length))
    .replace(/[\r\n]+$/, "");
  const position = { row: pos.line, column: pos.character };

  // detect reveal document
  const formats: string[] = [];
  if (isQuartoRevealDoc(doc)) {
    formats.push("revealjs");
  }

  return {
    path,
    filetype,
    embedded,
    line,
    code,
    position,
    explicit,
    trigger,
    formats,
    project_formats: [],
    engine: "jupyter",
    client: "lsp",
  };
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

export interface CompletionResult {
  token: string;
  completions: Completion[];
  cacheable: boolean;
}

export interface HoverResult {
  content: string;
  range: { start: Position; end: Position };
}

export interface Completion {
  type: string;
  value: string;
  display?: string;
  description?: string;
  suggest_on_accept?: boolean;
  replace_to_end?: boolean;
}

export interface Quarto {
  getYamlCompletions(context: EditorContext): Promise<CompletionResult>;
  getAttrCompletions(
    token: AttrToken,
    context: EditorContext
  ): Promise<CompletionItem[]>;
  getYamlDiagnostics(context: EditorContext): Promise<LintItem[]>;
  getHover?: (context: EditorContext) => Promise<HoverResult | null>;
  runQuarto: (options: ExecFileSyncOptions, ...args: string[]) => string;
  runPandoc: (options: ExecFileSyncOptions, ...args: string[]) => string;
  resourcePath: string;
}

export let quarto: Quarto | undefined;

export function initializeQuarto(quartoContext: QuartoContext) {
  initializeQuartoYamlModule(quartoContext.resourcePath)
    .then((mod) => {
      const quartoModule = mod as QuartoYamlModule;
      quarto = {
        getYamlCompletions: quartoModule.getCompletions,
        getAttrCompletions: initializeAttrCompletionProvider(
          quartoContext.resourcePath
        ),
        getYamlDiagnostics: quartoModule.getLint,
        getHover: quartoModule.getHover,
        runQuarto: quartoContext.runQuarto,
        runPandoc: quartoContext.runPandoc,
        resourcePath: quartoContext.resourcePath,
      };
    })
    .catch((error) => {
      console.log(error);
    });
}
