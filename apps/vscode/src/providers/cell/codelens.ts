/*
 * codelens.ts
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

// icon reference: https://code.visualstudio.com/api/references/icons-in-labels

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  ProviderResult,
  TextDocument,
  Range,
} from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import { languageNameFromBlock } from "../../markdown/language";
import { blockHasExecutor, hasExecutor } from "./executors";

export function quartoCellExecuteCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parseSync(document);
      const executableBlocks = tokens.filter(blockHasExecutor);
      for (let i = 0; i < executableBlocks.length; i++) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }

        const block = executableBlocks[i];
        if (block.map) {
          // detect the language and see if it has a cell executor
          const language = languageNameFromBlock(block);
          if (!hasExecutor(language)) {
            continue;
          }

          // push code lens
          const range = new Range(block.map[0], 0, block.map[0], 0);
          lenses.push(
            ...[
              new CodeLens(range, {
                title: "$(run) Run Cell",
                tooltip: "Execute the code in this cell",
                command: "quarto.runCurrentCell",
                arguments: [block.map[0] + 1],
              }),
            ]
          );
          if (i < executableBlocks.length - 1) {
            lenses.push(
              new CodeLens(range, {
                title: "Run Next Cell",
                tooltip: "Execute the next code cell",
                command: "quarto.runNextCell",
                arguments: [block.map[0] + 1],
              })
            );
          }
          if (i > 0) {
            lenses.push(
              new CodeLens(range, {
                title: "Run Above",
                tooltip: "Execute the cells above this one",
                command: "quarto.runCellsAbove",
                arguments: [block.map[0] + 1],
              })
            );
          }
        }
      }
      return lenses;
    },
  };
}
