/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";

import fileUrl from "file-url";
import { EditorContext, HoverResult } from "./quarto";

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

export interface Completion {
  type: string;
  value: string;
  display?: string;
  description?: string;
  suggest_on_accept?: boolean;
  replace_to_end?: boolean;
}

export interface QuartoYamlModule {
  getCompletions(context: EditorContext): Promise<CompletionResult>;
  getLint(context: EditorContext): Promise<Array<LintItem>>;
  getHover?: (context: EditorContext) => Promise<HoverResult | null>;
}

export function initializeQuartoYamlModule(
  resourcesPath: string
): Promise<QuartoYamlModule> {
  const modulePath = path.join(resourcesPath, "editor", "tools", "vs-code.mjs");
  return new Promise((resolve, reject) => {
    import(fileUrl(modulePath))
      .then((mod) => {
        const quartoModule = mod as QuartoYamlModule;
        resolve(quartoModule);
      })
      .catch((error) => {
        reject(error);
      });
  });
}
