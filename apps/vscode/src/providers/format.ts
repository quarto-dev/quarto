/*
 * format.ts
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

import {
  commands,
  FormattingOptions,
  Position,
  Range,
  TextDocument,
  TextEdit,
  window,
  workspace,
  CancellationToken,
  Uri,
} from "vscode";
import {
  ProvideDocumentFormattingEditsSignature,
  ProvideDocumentRangeFormattingEditsSignature,
} from "vscode-languageclient/node";
import { lines } from "core";
import { TokenCodeBlock, TokenMath, codeForExecutableLanguageBlock, languageBlockAtLine } from "quarto-core";

import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { EmbeddedLanguage, languageCanFormatDocument } from "../vdoc/languages";
import {
  languageFromBlock,
  mainLanguage,
  unadjustedRange,
  VirtualDoc,
  virtualDocForCode,
  virtualDocForLanguage,
  withVirtualDocUri,
} from "../vdoc/vdoc";

export function activateCodeFormatting(engine: MarkdownEngine) {
  return [new FormatCellCommand(engine)];
}

export function embeddedDocumentFormattingProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
    next: ProvideDocumentFormattingEditsSignature
  ): Promise<TextEdit[] | null | undefined> => {
    if (!isQuartoDoc(document, true)) {
      // Delegate if we don't handle it
      return next(document, options, token);
    }

    // Ensure we are dealing w/ the active document
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
      // Ensure that other formatters don't ever run over qmd files
      return [];
    }
    if (activeEditor.document.uri.toString() !== document.uri.toString()) {
      return [];
    }

    const tokens = engine.parse(document);

    // Figure out language to use. Try selection's block, then fall back to main doc language.
    const includeFence = false;
    const line = activeEditor.selection.active.line;
    const block = languageBlockAtLine(tokens, line, includeFence);

    let language = block ? languageFromBlock(block) : undefined;

    if (!language || !language.canFormat) {
      language = mainLanguage(tokens, (lang) => !!lang.canFormat);
    }

    if (!language) {
      // No language that can format in any way
      return [];
    }

    if (languageCanFormatDocument(language)) {
      // Full document formatting support
      const vdoc = virtualDocForLanguage(document, tokens, language);
      return executeFormatDocumentProvider(
        vdoc,
        document,
        formattingOptions(document.uri, vdoc.language, options)
      );
    } else if (block) {
      // Just format the selected block if there is one
      const edits = await formatBlock(document, block);
      return edits ? edits : [];
    } else {
      // Nothing we can format
      return [];
    }
  };
}

export function embeddedDocumentRangeFormattingProvider(
  engine: MarkdownEngine
) {
  return async (
    document: TextDocument,
    range: Range,
    options: FormattingOptions,
    token: CancellationToken,
    next: ProvideDocumentRangeFormattingEditsSignature
  ): Promise<TextEdit[] | null | undefined> => {
    if (!isQuartoDoc(document, true)) {
      // If we don't perform any formatting, then call the next handler
      return next(document, range, options, token);
    }

    const includeFence = false;
    const tokens = engine.parse(document);

    const block = languageBlockAtLine(tokens, range.start.line, includeFence);
    if (!block) {
      // Don't let anyone else format qmd files
      return [];
    }

    const endBlock = languageBlockAtLine(tokens, range.end.line, includeFence);
    if (!endBlock) {
      // Selection extends outside of a single block and into ambiguous non-block editor space
      // (possibly spanning multiple blocks in the process)
      return [];
    }

    if (block.range.start.line !== endBlock.range.start.line) {
      // Selection spans multiple blocks
      return [];
    }

    const edits = await formatBlock(document, block);
    if (!edits) {
      return [];
    }

    return edits;
  };
}

class FormatCellCommand implements Command {
  public readonly id = "quarto.formatCell";
  constructor(private readonly engine_: MarkdownEngine) { }

  public async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      // No active text editor
      return;
    }

    const document = editor.document;
    if (!isQuartoDoc(document)) {
      window.showInformationMessage("Active editor is not a Quarto document");
      return;
    }

    const includeFence = false;

    const tokens = this.engine_.parse(document);
    const block = languageBlockAtLine(tokens, editor.selection.start.line, includeFence);
    if (!block) {
      window.showInformationMessage("Editor selection is not within a code cell.");
      return;
    }

    const edits = await formatBlock(document, block);
    if (!edits) {
      // Nothing to do! Already formatted, or no formatter picked us up, or this language doesn't support formatting.
      return;
    }

    editor.edit((editBuilder) => {
      // Sort edits by descending start position to avoid range shifting issues
      edits
        .slice()
        .sort((a, b) => b.range.start.compareTo(a.range.start))
        .forEach((edit) => {
          editBuilder.replace(edit.range, edit.newText);
        });
    });
  }
}

function formattingOptions(
  uri: Uri,
  language: EmbeddedLanguage,
  defaultOptions?: FormattingOptions
): FormattingOptions {
  const config = workspace.getConfiguration(undefined, {
    uri: uri,
    languageId: language.ids[0],
  });
  return {
    tabSize: config.get<number>("editor.tabSize", defaultOptions?.tabSize ?? 4),
    insertSpaces: config.get<boolean>(
      "editor.insertSpaces",
      defaultOptions?.insertSpaces ?? true
    ),
  };
}

async function executeFormatDocumentProvider(
  vdoc: VirtualDoc,
  document: TextDocument,
  options: FormattingOptions
): Promise<TextEdit[] | undefined> {
  const edits = await withVirtualDocUri(vdoc, document.uri, "format", async (uri: Uri) => {
    return await commands.executeCommand<TextEdit[] | undefined>(
      "vscode.executeFormatDocumentProvider",
      uri,
      options
    );
  });
  if (edits) {
    return unadjustedEdits(edits, vdoc.language);
  } else {
    return undefined;
  }
}

async function formatBlock(doc: TextDocument, block: TokenMath | TokenCodeBlock): Promise<TextEdit[] | undefined> {
  // Extract language
  const language = languageFromBlock(block);
  if (!language) {
    return undefined;
  }

  // Refuse to format if not supported by this language
  if (!language.canFormat) {
    return undefined;
  }

  // Create virtual document containing the block
  const blockLines = lines(codeForExecutableLanguageBlock(block, false));
  const vdoc = virtualDocForCode(blockLines, language);

  const edits = await executeFormatDocumentProvider(
    vdoc,
    doc,
    formattingOptions(doc.uri, vdoc.language)
  );

  if (!edits) {
    // Either no formatter picked us up, or there were no edits required.
    // We can't determine the difference though!
    return undefined;
  }

  // Because we format with the block code copied in an empty virtual
  // document, we need to adjust the ranges to match the edits to the block
  // cell in the original file.
  const blockRange = new Range(
    new Position(block.range.start.line, block.range.start.character),
    new Position(block.range.end.line, block.range.end.character)
  );
  const adjustedEdits = edits
    .map(edit => {
      const range = new Range(
        new Position(edit.range.start.line + block.range.start.line + 1, edit.range.start.character),
        new Position(edit.range.end.line + block.range.start.line + 1, edit.range.end.character)
      );
      return new TextEdit(range, edit.newText);
    });

  // Bail if any edit is out of range. We used to filter these edits out but
  // this could bork the cell. Return `[]` to indicate that we tried.
  if (adjustedEdits.some(edit => !blockRange.contains(edit.range))) {
    window.showInformationMessage(
      "Formatting edits were out of range and could not be applied to the code cell."
    );
    return [];
  }

  return adjustedEdits;
}

function unadjustedEdits(
  edits: TextEdit[],
  language: EmbeddedLanguage
): TextEdit[] {
  return edits.map((edit) => {
    return new TextEdit(unadjustedRange(language, edit.range), edit.newText);
  });
}
