/*
 * codelens.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
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
import { blockHasExecutor, hasExecutor } from "./executors";
import { Token, languageNameFromBlock } from "quarto-core";
import { ExtensionHost } from "../../host";

export function quartoCellExecuteCodeLensProvider(
  host: ExtensionHost,
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parse(document);
      const executableBlocks = tokens.filter((token?: Token) => blockHasExecutor(host, token));
      for (let i = 0; i < executableBlocks.length; i++) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }

        const block = executableBlocks[i];

        // detect the language and see if it has a cell executor
        const language = languageNameFromBlock(block);
        if (!hasExecutor(host, language)) {
          continue;
        }

        // push code lens
        const line = block.range.start.line;
        const range = new Range(line, 0, line, 0);
        lenses.push(
          ...[
            new CodeLens(range, {
              title: "$(run) Run Cell",
              tooltip: "Execute the code in this cell",
              command: "quarto.runCurrentCell",
              arguments: [line + 1],
            }),
          ]
        );
        if (i < executableBlocks.length - 1) {
          lenses.push(
            new CodeLens(range, {
              title: "Run Next Cell",
              tooltip: "Execute the next code cell",
              command: "quarto.runNextCell",
              arguments: [line + 1],
            })
          );
        }
        if (i > 0) {
          lenses.push(
            new CodeLens(range, {
              title: "Run Above",
              tooltip: "Execute the cells above this one",
              command: "quarto.runCellsAbove",
              arguments: [line + 1],
            })
          );
        }

      }
      return lenses;
    },
  };
}
