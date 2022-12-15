/*
 * quarto-yaml.ts
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
