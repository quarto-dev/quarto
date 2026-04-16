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
import { optionCommentPattern } from "./cell/options";
import { EmbeddedLanguage, languageCanFormatDocument } from "../vdoc/languages";
import {
  isBlockOfLanguage,
  languageFromBlock,
  mainLanguage,
  unadjustedRange,
  VirtualDoc,
  virtualDocForCode,
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

    // If the selected language supports whole-document formatting, format
    // every block of it; otherwise, format only the cell containing the
    // cursor. Either way, each block is routed through `formatBlock` so
    // that Quarto option directives are protected by the same
    // strip-before-format path and can't leak to the language formatter.
    const targetBlocks: (TokenMath | TokenCodeBlock)[] = languageCanFormatDocument(language)
      ? (tokens.filter(isBlockOfLanguage(language)) as (TokenMath | TokenCodeBlock)[])
      : block
        ? [block]
        : [];

    // Document formatting is all-or-nothing: if any block fails the
    // out-of-range guard, abort the whole operation rather than apply a
    // partial format. We pass `silentOutOfRange: true` so per-block
    // failures don't toast individually; a single aggregated message is
    // shown below.
    const allEdits: TextEdit[] = [];
    let outOfRangeBlockFailures = 0;
    for (const target of targetBlocks) {
      const edits = await formatBlock(document, target, options, true);
      if (edits === undefined) {
        continue;
      }
      if (edits.length === 0) {
        outOfRangeBlockFailures++;
        continue;
      }
      allEdits.push(...edits);
    }
    if (outOfRangeBlockFailures > 0) {
      window.showInformationMessage(
        `Formatting edits were out of range in ${outOfRangeBlockFailures} code cell${outOfRangeBlockFailures === 1 ? "" : "s"}; document was not modified.`
      );
      return [];
    }
    return allEdits;
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

    const edits = await formatBlock(document, block, options);
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

    const editorOptions: FormattingOptions = {
      tabSize: typeof editor.options.tabSize === "number" ? editor.options.tabSize : 4,
      insertSpaces: typeof editor.options.insertSpaces === "boolean" ? editor.options.insertSpaces : true,
    };
    const edits = await formatBlock(document, block, editorOptions);
    if (!edits || edits.length === 0) {
      // Nothing to do! Already formatted, no formatter picked us up, this
      // language doesn't support formatting, or the edits were out of range
      // (the user already saw a toast from formatBlock in that case).
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

async function formatBlock(
  doc: TextDocument,
  block: TokenMath | TokenCodeBlock,
  defaultOptions?: FormattingOptions,
  silentOutOfRange: boolean = false
): Promise<TextEdit[] | undefined> {
  // Extract language
  const language = languageFromBlock(block);
  if (!language) {
    return undefined;
  }

  // Refuse to format if not supported by this language
  if (!language.canFormat) {
    return undefined;
  }

  const blockLines = lines(codeForExecutableLanguageBlock(block, false));

  // Count leading Quarto option directives (e.g. `#| label: foo`) so we can
  // hide them from the formatter entirely. Feeding these lines to formatters
  // like Black or styler risks reflowing or rewriting them, which would
  // silently break the cell's behaviour on the next render. We reuse
  // `optionCommentPattern` from `cell/options.ts` so this code path can
  // never drift from Quarto's own cell-option parser: any variant the
  // executor recognises (`#| label`, `#|label`, `# | label`, `#|  label`,
  // ...) is automatically protected here. `language.comment` is the
  // canonical comment string from `editor-core` and covers every formatter
  // language (including TypeScript, which was missing from the ad-hoc map
  // the previous implementation used). Note: block-comment languages (C,
  // CSS, SAS) use a tuple comment-char in `cell/options.ts` with a suffix
  // check; those languages do not have `canFormat: true` in
  // `vdoc/languages.ts`, so they never reach this code path.
  const optionPattern = language.comment
    ? optionCommentPattern(language.comment)
    : undefined;
  let optionLines = 0;
  if (optionPattern) {
    for (const line of blockLines) {
      if (optionPattern.test(line)) {
        optionLines++;
      } else {
        break;
      }
    }
  }

  // Create virtual document containing only the code portion of the block
  // so the formatter never sees the option directives.
  const codeLines = blockLines.slice(optionLines);

  // Nothing to format if the block is entirely option directives (or only
  // trailing whitespace after them, which `lines()` may produce from a
  // final newline in `token.data`).
  if (codeLines.every(l => l.trim() === "")) {
    return undefined;
  }
  const vdoc = virtualDocForCode(codeLines, language);

  const edits = await executeFormatDocumentProvider(
    vdoc,
    doc,
    formattingOptions(doc.uri, vdoc.language, defaultOptions)
  );

  if (!edits || edits.length === 0) {
    // Either no formatter picked us up, or there were no edits required.
    // We can't determine the difference though!
    return undefined;
  }

  // Because we format with the block code copied in an empty virtual
  // document, we need to adjust the ranges to match the edits to the block
  // cell in the original file. The `+ 1` skips the opening fence line and
  // `+ optionLines` skips the leading option directives we hid from the
  // formatter.
  const lineOffset = block.range.start.line + 1 + optionLines;
  const blockRange = new Range(
    new Position(block.range.start.line, block.range.start.character),
    new Position(block.range.end.line, block.range.end.character)
  );
  const adjustedEdits = edits.map(edit => {
    const range = new Range(
      new Position(edit.range.start.line + lineOffset, edit.range.start.character),
      new Position(edit.range.end.line + lineOffset, edit.range.end.character)
    );
    return new TextEdit(range, edit.newText);
  });

  // Bail if any edit is out of range. We used to filter these edits out but
  // this could bork the cell. Return `[]` to indicate that we tried.
  if (adjustedEdits.some(edit => !blockRange.contains(edit.range))) {
    if (!silentOutOfRange) {
      window.showInformationMessage(
        "Formatting edits were out of range and could not be applied to the code cell."
      );
    }
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
