/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  CodeLens,
  CodeLensProvider,
  ProviderResult,
  TextDocument,
  Range,
  CancellationToken,
} from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import { isDiagram } from "../../markdown/language";

export function diagramCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parseSync(document);
      const diagramBlocks = tokens.filter(isDiagram);
      for (let i = 0; i < diagramBlocks.length; i++) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }

        const block = diagramBlocks[i];
        if (block.map) {
          // push code lens
          const range = new Range(block.map[0], 0, block.map[0], 0);
          lenses.push(
            ...[
              new CodeLens(range, {
                title: "$(zoom-in) Preview",
                tooltip: "Preview the diagram",
                command: "quarto.previewDiagram",
                arguments: [block.map[0] + 1],
              }),
            ]
          );
        }
      }
      return lenses;
    },
  };
}
