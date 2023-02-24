/*
 * codeviews.ts
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

import { CompletionList, Range} from "vscode-languageserver-types";

export const kCodeViewGetCompletions = 'code_view_get_completions';

export type CodeViewExecute = "selection" | "cell" | "above" | "below";

export interface CodeViewActiveBlockContext {
  activeLanguage: string;
  blocks: Array<{ pos: number, language: string, code: string; active: boolean }>;
  selection: Range;
  selectedText: string;
}

export type CodeViewSelectionAction = "nextline" | "nextblock" | "prevblock";

export interface CodeViewCompletionContext {
  filepath: string;
  language: string;
  code: string[];
  cellBegin: number;
  cellEnd: number;
  selection: Range;
  explicit: boolean;
}

export interface CodeViewServer {
  codeViewCompletions: (context: CodeViewCompletionContext) => Promise<CompletionList>;
}


