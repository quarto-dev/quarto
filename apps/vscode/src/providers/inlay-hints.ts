import {
  InlayHint,
  Range,
  CancellationToken,
  commands,
  TextDocument,
  Uri
} from "vscode";
import { ProvideInlayHintsSignature } from "vscode-languageclient";
import { unadjustedPosition, adjustedRange, languages, virtualDocForLanguage, withVirtualDocUri, unadjustedRange } from "../vdoc/vdoc";
import { MarkdownEngine } from "../markdown/engine";
import { isQuartoDoc, isQuartoYaml } from "../core/doc";

/**
 * Provides inlay hints for all embedded languages within a single document
 *
 * Note that `vscode.executeInlayHintProvider` does not currently "resolve"
 * inlay hints, so if the underlying provider delays the text edits (that you'd
 * get when you double click) to resolve time, then we will never see them in the
 * quarto document (for example, pylance delays, but basedpyright does not).
 * https://github.com/microsoft/vscode/issues/249359
 */
export function embeddedInlayHintsProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    range: Range,
    token: CancellationToken,
    next: ProvideInlayHintsSignature
  ): Promise<InlayHint[] | null | undefined> => {
    if (isQuartoYaml(document)) {
      // The LSP client tracks quarto related yaml files like `_quarto.yaml`,
      // but we don't provide inlay hints for these. Calling `next()` results
      // in an "unhandled method" toast notification, so we return `undefined`
      // directly instead. Is there a better solution?
      return undefined;
    }
    if (!isQuartoDoc(document, true)) {
      return await next(document, range, token);
    }

    const tokens = engine.parse(document);

    // Determine all embedded languages used within this document
    const embeddedLanguages = languages(tokens);

    // Fetch inlay hints for each embedded language
    const hints: InlayHint[] = [];

    for (const embeddedLanguage of embeddedLanguages) {
      const vdoc = virtualDocForLanguage(document, tokens, embeddedLanguage);

      if (!vdoc) {
        const language = embeddedLanguage.ids.at(0) ?? "??";
        console.error(`[InlayHints] No virtual document produced for language: ${language}.`);
        continue;
      };

      // Map `range` into adjusted vdoc range
      const vdocRange = adjustedRange(vdoc.language, range);

      // Get inlay hints for this embedded language's vdoc
      const vdocHints = await withVirtualDocUri(vdoc, document.uri, "inlayHints", async (uri: Uri) => {
        try {
          return await commands.executeCommand<InlayHint[]>(
            "vscode.executeInlayHintProvider",
            uri,
            vdocRange
          );
        } catch (error) {
          const language = embeddedLanguage.ids.at(0) ?? "??";
          console.warn(`[InlayHints] Error getting hints for language: ${language}. ${error}`);
        }
      })

      if (!vdocHints) {
        continue;
      }

      // Map results back to original doc range. Two places to update:
      // - `InlayHint.position`
      // - `InlayHint.textEdits.range`
      vdocHints.forEach((hint) => {
        // Unconditional `position` of where to show the inlay hint
        hint.position = unadjustedPosition(vdoc.language, hint.position);

        // Optional set of `textEdits` to "accept" the inlay hint
        if (hint.textEdits) {
          hint.textEdits.forEach((textEdit) => {
            textEdit.range = unadjustedRange(vdoc.language, textEdit.range);
          });
        }
      });

      hints.push(...vdocHints);
    }

    return hints;
  };
}
