/*
 * codelens.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import {
  CodeLens,
  CodeLensProvider,
  ProviderResult,
  TextDocument,
  Range,
  CancellationToken,
} from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import { isDiagram } from "quarto-core";

export function diagramCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parse(document);
      const diagramBlocks = tokens.filter(isDiagram);
      for (let i = 0; i < diagramBlocks.length; i++) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }

        const block = diagramBlocks[i];

        // push code lens
        const range = new Range(block.range.start.line, 0, block.range.start.line, 0);
        lenses.push(
          ...[
            new CodeLens(range, {
              title: "$(zoom-in) Preview",
              tooltip: "Preview the diagram",
              command: "quarto.previewDiagram",
              arguments: [{ textEditorLine: block.range.start.line + 1 }],
            }),
          ]
        );

      }
      return lenses;
    },
  };
}
