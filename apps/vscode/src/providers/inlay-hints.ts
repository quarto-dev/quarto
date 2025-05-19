import { InlayHint, Range } from "vscode";
import {
  CancellationToken,
  commands,
  Position,
  TextDocument,
} from "vscode";

import { ProvideInlayHintsSignature } from "vscode-languageclient";
import { unadjustedPosition, adjustedRange, languageAtPosition, virtualDoc, virtualDocUri } from "../vdoc/vdoc";
import { MarkdownEngine } from "../markdown/engine";

import { isQuartoDoc } from "../core/doc";

export function embeddedInlayHintsProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    range: Range,
    token: CancellationToken,
    next: ProvideInlayHintsSignature
  ): Promise<InlayHint[] | null | undefined> => {
    if (!isQuartoDoc(document, true)) {
      return await next(document, range, token);
    }

    const tokens = engine.parse(document);

    // Find the start position of each embedded language
    const languagePositions: Map<String, Position> = new Map();
    for (let line = range.start.line; line < range.end.line; line++) {
      const pos = new Position(line, 0);
      const lang = languageAtPosition(tokens, pos)?.extension;
      if (lang && !languagePositions.has(lang)) {
        languagePositions.set(lang, pos);
      }
    }

    // Fetch inlay hints for each embedded language
    const allHints: InlayHint[] = [];
    for (const [lang, pos] of languagePositions.entries()) {
      const vdoc = await virtualDoc(document, pos, engine);
      if (!vdoc) {
        console.error(`[InlayHints] No virtual document produced for ${lang} at ${pos.line}`);
        continue;
      };

      const vdocUri = await virtualDocUri(vdoc, document.uri, "inlayHints");
      const vRange = adjustedRange(vdoc.language, range);

      try {
        const hints = await commands.executeCommand<InlayHint[]>(
          "vscode.executeInlayHintProvider",
          vdocUri.uri,
          vRange
        );
        // Map results back to original doc range if needed (optional for inlay hints)
        if (hints && hints.length > 0) {
          hints.forEach((hint) => {
            hint.position = unadjustedPosition(vdoc.language, hint.position);
            if (Array.isArray(hint.textEdits) && hint.textEdits.length > 0) {
              hint.textEdits.forEach((edit) => {
                const start = unadjustedPosition(vdoc.language, edit.range.start);
                const end = unadjustedPosition(vdoc.language, edit.range.end);
                edit.range = new Range(start, end);
              });
            }
          });
          allHints.push(...hints);
        }
      } catch (e) {
        console.warn(`[InlayHints] Error getting hints for ${lang}:`, e);
      } finally {
        if (vdocUri.cleanup) {
          await vdocUri.cleanup();
        }
      }
    }

    return allHints;
  };
}
