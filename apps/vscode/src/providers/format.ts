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
  TextEditor,
} from "vscode";
import {
  ProvideDocumentFormattingEditsSignature,
  ProvideDocumentRangeFormattingEditsSignature,
} from "vscode-languageclient/node";
import { languageBlockAtPosition } from "quarto-core";

import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { EmbeddedLanguage, langageCanFormatDocument, langaugeCanFormatSelection } from "../vdoc/languages";
import {
  adjustedPosition,
  isBlockOfLanguage,
  languageAtPosition,
  mainLanguage,
  unadjustedRange,
  VirtualDoc,
  virtualDoc,
  virtualDocForLanguage,
  virtualDocUri,
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
    if (isQuartoDoc(document, true)) {
      // ensure we are dealing w/ the active document
      const editor = window.activeTextEditor;
      const activeDocument = editor?.document;
      if (
        editor &&
        activeDocument?.uri.toString() === document.uri.toString()
      ) {
        const line = editor.selection.active.line;
        const position = new Position(line, 0);
        const tokens = engine.parse(document);
        let language = languageAtPosition(tokens, position);
        if (!language || !language.canFormat) {
          language = mainLanguage(tokens, (lang) => !!lang.canFormat);
        }
        if (language) {
          const vdoc = virtualDocForLanguage(document, tokens, language);
          if (vdoc) {
            if (langageCanFormatDocument(language)) {
              return executeFormatDocumentProvider(
                vdoc,
                document,
                formattingOptions(document.uri, vdoc.language, options)
              );
            } else if (language.canFormatOnSave !== false &&  langaugeCanFormatSelection(language, document.uri)) {
              const vdocUri = await virtualDocUri(vdoc, document.uri, "format");
              const edits = await withVirtualDocUri(vdocUri, async (uri: Uri) => {
                const edits: TextEdit[] = [];
                for (const token of tokens.filter(isBlockOfLanguage(language!)).reverse()) {
                  const rangeEdits = await executeFormatRangeProvider(
                    uri,
                    adjustedCellRange(vdoc.language, document, token.range.start.line + 1, token.range.end.line - 1),
                    formattingOptions(document.uri, vdoc.language)
                  );
                  if (rangeEdits) {
                    edits.push(...rangeEdits);
                  }
                }
                return edits;
              });
              return unadjustedEdits(edits, vdoc.language);;
            }
          }
        }
      }
      // ensure that other formatters don't ever run over qmd files
      return [];
    } else {
      // delegate if we didn't handle it
      return next(document, options, token);
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
    if (isQuartoDoc(document, true)) {
      const tokens = engine.parse(document);
      const beginBlock = languageBlockAtPosition(tokens, range.start, false);
      const endBlock = languageBlockAtPosition(tokens, range.end, false);
      if (beginBlock && (beginBlock.range.start.line === endBlock?.range.start.line)) {
        const vdoc = await virtualDoc(document, range.start, engine);
        if (vdoc) {
          const vdocUri = await virtualDocUri(vdoc, document.uri, "format");
          const edits = await withVirtualDocUri(vdocUri, async (uri: Uri) => {
            return await executeFormatRangeProvider(
              uri,
              new Range(
                adjustedPosition(vdoc.language, range.start),
                adjustedPosition(vdoc.language, range.end)
              ),
              formattingOptions(document.uri, vdoc.language, options)
            );
          });
          if (edits) {
            return unadjustedEdits(edits, vdoc.language);
          }
        }
      }
      // ensure that other formatters don't ever run over qmd files
      return [];
    } else {
      // if we don't perform any formatting, then call the next handler
      return next(document, range, options, token);
    }
  };
}

class FormatCellCommand implements Command {
  public readonly id = "quarto.formatCell";
  constructor(private readonly engine_: MarkdownEngine) {}

  public async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const result = await virtualDocForActiveCell(editor, this.engine_);
      if (result) {
        const { vdoc, startLine, endLine } = result;
        if (langaugeCanFormatSelection(vdoc.language, doc.uri)) {
          const vdocUri = await virtualDocUri(vdoc, doc.uri, "format");
          const edits = await withVirtualDocUri(vdocUri, async (uri: Uri) => {
            return await executeFormatRangeProvider(
              uri,
              adjustedCellRange(vdoc.language, doc, startLine, endLine),
              formattingOptions(doc.uri, vdoc.language)
            );
          });
          if (edits) {
            editor.edit((editBuilder) => {
              unadjustedEdits(edits, vdoc.language).forEach((edit) => {
                editBuilder.replace(edit.range, edit.newText);
              });
            });
          }
        } else if (langageCanFormatDocument(vdoc.language)) {
          const edits = await executeFormatDocumentProvider(
            vdoc,
            doc,
            formattingOptions(doc.uri, vdoc.language)
          );
          if (edits) {
            editor.edit((editBuilder) => {
              edits.forEach((edit) => {
                editBuilder.replace(edit.range, edit.newText);
              });
            });
          }
       
        }
      } else {
        window.showInformationMessage(
          "Editor selection is not within a code cell"
        );
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
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

async function virtualDocForActiveCell(
  editor: TextEditor,
  engine: MarkdownEngine
) {
  const tokens = engine.parse(editor.document);
  const line = editor.selection.start.line;
  const position = new Position(line, 0);
  const block = languageBlockAtPosition(tokens, position, false);
  if (block) {
    const vdoc = await virtualDoc(editor.document, position, engine, block);
    if (vdoc) {
      return { vdoc, startLine: block.range.start.line + 1, endLine: block.range.end.line - 1 };
    }
  }
  // no virtual doc
  return undefined;
}

async function executeFormatRangeProvider(
  uri: Uri,
  range: Range,
  options: FormattingOptions
): Promise<TextEdit[] | undefined> {
  return commands.executeCommand<TextEdit[]>(
    "vscode.executeFormatRangeProvider",
    uri,
    range,
    options
  );
}

async function executeFormatDocumentProvider(
  vdoc: VirtualDoc,
  document: TextDocument,
  options: FormattingOptions
): Promise<TextEdit[] | undefined> {
  const vdocUri = await virtualDocUri(vdoc, document.uri, "format");
  const edits = await withVirtualDocUri(vdocUri, async (uri: Uri) => {
    return await commands.executeCommand<TextEdit[]>(
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

function adjustedCellRange(
  language: EmbeddedLanguage,
  document: TextDocument,
  startLine: number,
  endLine: number
): Range {
  return new Range(
    adjustedPosition(language, new Position(startLine, 0)),
    adjustedPosition(
      language,
      new Position(
        endLine,
        Math.max(document.lineAt(endLine).text.length - 1, 0)
      )
    )
  );
}

function unadjustedEdits(
  edits: TextEdit[],
  language: EmbeddedLanguage
): TextEdit[] {
  return edits.map((edit) => {
    return new TextEdit(unadjustedRange(language, edit.range), edit.newText);
  });
}
