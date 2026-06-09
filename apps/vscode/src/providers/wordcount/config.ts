/*
 * config.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import { workspace } from "vscode";
import { WordCountOptions } from "./count";

export const kWordCountEnabled = "quarto.wordCount.enabled";
export const kWordCountIncludeCodeCells = "quarto.wordCount.includeCodeCells";

export function wordCountEnabled(): boolean {
  return workspace.getConfiguration("quarto").get<boolean>("wordCount.enabled", true);
}

export function wordCountOptions(): WordCountOptions {
  return {
    includeCodeCells: workspace
      .getConfiguration("quarto")
      .get<boolean>("wordCount.includeCodeCells", false),
  };
}

export function affectsWordCount(affects: (section: string) => boolean): boolean {
  return affects(kWordCountEnabled) || affects(kWordCountIncludeCodeCells);
}

// "1,432 words" / "1 word"
export function formatWordCount(words: number): string {
  return `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`;
}
