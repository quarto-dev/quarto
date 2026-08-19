/*
 * background.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 * Copyright (c) [2021] [Chris Bain] (https://github.com/baincd/vscode-markdown-color-plus/)
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


import * as vscode from "vscode";

import { isQuartoDoc, kQuartoDocSelector } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { isExecutableLanguageBlock, languageNameFromBlock } from "quarto-core";
import { vscRange } from "../core/range";
import { createThrottle } from "../core/throttle";
import { langCommentChars, optionCommentPattern } from "./cell/comment-chars";

export function activateBackgroundHighlighter(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
) {
  // read config and monitor it for changes
  highlightingConfig.sync();
  vscode.workspace.onDidChangeConfiguration(
    () => {
      highlightingConfig.sync();
      updateAllEditorsDecorationsThrottled(engine);
    },
    null,
    context.subscriptions
  );

  // update highlighting when docs are opened
  vscode.workspace.onDidOpenTextDocument(
    (doc) => {
      if (doc === vscode.window.activeTextEditor?.document) {
        if (!isQuartoDoc(doc)) {
          clearEditorHighlightDecorations(vscode.window.activeTextEditor);
        } else {
          updateActiveEditorDecorationsThrottled(
            vscode.window.activeTextEditor,
            engine
          );
        }
      }
    },
    null,
    context.subscriptions
  );

  // update highlighting when visible text editors change
  vscode.window.onDidChangeVisibleTextEditors(
    (visibleEditors) => {
      for (const editor of editorThrottledFunctions.keys()) {
        if (!visibleEditors.includes(editor)) {
          editorThrottledFunctions.delete(editor);
        }
      }
      updateAllEditorsDecorationsThrottled(engine);
    },
    null,
    context.subscriptions
  );

  // update highlighting on changes to the document (if its visible)
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const visibleEditor = vscode.window.visibleTextEditors.find(editor => {
        return editor.document.uri.toString() === event.document.uri.toString();
      });
      if (visibleEditor) {
        updateActiveEditorDecorationsThrottled(
          visibleEditor,
          engine,
          event.contentChanges.length === 1
            ? event.contentChanges[0].range.start
            : undefined
        );
      }
    },
    null,
    context.subscriptions
  );

  // update highlighting for ordinary document highlighter callbacks
  context.subscriptions.push(
    vscode.languages.registerDocumentHighlightProvider(kQuartoDocSelector, {
      provideDocumentHighlights: function (
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ) {
        if (document === vscode.window.activeTextEditor?.document) {
          updateActiveEditorDecorationsThrottled(
            vscode.window.activeTextEditor,
            engine,
            position,
            token
          );
        }
        return [];
      },
    })
  );

  // highlight all editors at activation time
  updateAllEditorsDecorationsThrottled(engine);
}

// Map of editors to their throttled update functions
const editorThrottledFunctions = new Map<vscode.TextEditor, () => void>();
function updateActiveEditorDecorationsThrottled(
  editor: vscode.TextEditor,
  engine: MarkdownEngine,
  pos?: vscode.Position,
  token?: vscode.CancellationToken
) {
  let throttled = editorThrottledFunctions.get(editor);
  if (!throttled) {
    throttled = createThrottle(
      () => setEditorHighlightDecorations(editor, engine, pos, token),
      () => highlightingConfig.delayMs()
    );
    editorThrottledFunctions.set(editor, throttled);
  }
  throttled();
}

function updateAllEditorsDecorationsThrottled(engine: MarkdownEngine) {
  for (const editor of vscode.window.visibleTextEditors) {
    updateActiveEditorDecorationsThrottled(editor, engine);
  }
}

async function setEditorHighlightDecorations(
  editor: vscode.TextEditor,
  engine: MarkdownEngine,
  _pos?: vscode.Position,
  _token?: vscode.CancellationToken
) {
  if (!editor || !isQuartoDoc(editor.document)) {
    return;
  }

  // ranges to highlight
  const blockRanges: vscode.Range[] = [];
  const inlineRanges: vscode.Range[] = [];
  const optionLineRanges: vscode.Range[] = [];
  const optionSeparatorRanges: vscode.Range[] = [];

  if (highlightingConfig.enabled()) {

    // find code blocks
    const tokens = engine.parse(editor.document);
    for (const block of tokens.filter(isExecutableLanguageBlock)) {
      const blockRange = vscRange(block.range);
      blockRanges.push(blockRange);

      // cell options (#| comments) get a darker background, and the last
      // option line gets a separator (rendered as a bottom border)
      if (highlightingConfig.cellOptionsBackgroundEnabled()) {
        const lines = cellOptionLines(
          editor.document,
          blockRange,
          languageNameFromBlock(block)
        );
        for (const line of lines) {
          optionLineRanges.push(editor.document.lineAt(line).range);
        }
        if (lines.length > 0) {
          optionSeparatorRanges.push(
            editor.document.lineAt(lines[lines.length - 1]).range
          );
        }
      }
    }

    // find inline executable code
    for (let i = 0; i < editor.document.lineCount; i++) {
      const line = editor.document.lineAt(i);
      const matches = line.text.matchAll(/(^|[^`])`{[\w_]+}[ \t]([^`]+)`/g);
      for (const match of matches) {
        if (match.index !== undefined) {
          const begin = new vscode.Position(i, match.index + match[1].length);
          const end = new vscode.Position(i, begin.character + match[0].length - match[1].length);
          inlineRanges.push(new vscode.Range(begin, end));
        }
      }
    }
  }


  // set highlights (could be none if we highlighting isn't enabled)
  editor.setDecorations(
    highlightingConfig.backgroundDecoration(),
    blockRanges
  );
  editor.setDecorations(
    highlightingConfig.inlineBackgroundDecoration(),
    inlineRanges
  );
  editor.setDecorations(cellOptionsBackgroundDecoration, optionLineRanges);
  editor.setDecorations(cellOptionsSeparatorDecoration, optionSeparatorRanges);
}

function clearEditorHighlightDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(highlightingConfig.backgroundDecoration(), []);
  editor.setDecorations(highlightingConfig.inlineBackgroundDecoration(), []);
  editor.setDecorations(cellOptionsBackgroundDecoration, []);
  editor.setDecorations(cellOptionsSeparatorDecoration, []);
}

// these composite on top of the cell background decoration, so a
// translucent black overlay reads as "slightly darker" in both themes
// (the text is also slightly dimmed to de-emphasize options vs. code)
const cellOptionsBackgroundDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  opacity: "0.75",
  light: {
    backgroundColor: "#00000012",
  },
  dark: {
    backgroundColor: "#00000033",
  },
});

// the separator is rendered via an "after" attachment (absolutely
// positioned to span the bottom of the row) rather than a border on the
// line itself: vscode applies line decorations to every visual row of a
// soft-wrapped line, which would repeat the border on each wrapped row,
// while an attachment is placed once, after the line's content
const cellOptionsSeparatorDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  after: {
    contentText: "",
    textDecoration:
      "none; position: absolute; left: 0; bottom: 0; width: 100vw; border-bottom: 1px solid;",
  },
  light: {
    after: {
      borderColor: "#00000025",
    },
  },
  dark: {
    after: {
      borderColor: "#FFFFFF25",
    },
  },
});

// document lines of the leading run of cell option comments in a cell
// (#| for python/r, //| for js, etc. -- the same pattern used by the
// tmLanguage rules generated in ../../syntaxes/build-lang.js, with
// optional leading indentation allowed)
//
// note: block-comment languages (e.g. /*| ... */ for c and css) are not
// supported (same as the tmLanguage)
function cellOptionLines(
  document: vscode.TextDocument,
  blockRange: vscode.Range,
  language: string
): number[] {
  const commentChars = langCommentChars(language);
  if (commentChars.length > 1) {
    return [];
  }
  const pattern = new RegExp(
    "^\\s*" + optionCommentPattern(commentChars[0]).source.replace(/^\^/, "")
  );
  const lines: number[] = [];
  const lastLine = Math.min(blockRange.end.line, document.lineCount - 1);
  for (let i = blockRange.start.line + 1; i <= lastLine; i++) {
    if (!pattern.test(document.lineAt(i).text)) {
      break;
    }
    lines.push(i);
  }
  return lines;
}

enum CellBackgroundColor {
  default = "default",
  off = "off",
  useTheme = "useTheme",
}

class HiglightingConfig {
  constructor() { }

  public enabled() {
    return this.enabled_;
  }

  public cellOptionsBackgroundEnabled() {
    return this.cellOptionsBackground_;
  }

  public backgroundDecoration() {
    return this.backgroundDecoration_!;
  }

  public inlineBackgroundDecoration() {
    return this.inlineBackgroundDecoration_!;
  }

  public delayMs() {
    return this.delayMs_;
  }

  public sync() {
    const config = vscode.workspace.getConfiguration("quarto");
    const backgroundOption = config.get<CellBackgroundColor>("cells.background.color", CellBackgroundColor.default);
    let light, dark;
    if (backgroundOption === CellBackgroundColor.useTheme) {
      const activeCellBackgroundThemeColor = new vscode.ThemeColor('notebook.selectedCellBackground');
      light = activeCellBackgroundThemeColor;
      dark = activeCellBackgroundThemeColor;
    } else {
      light = config.get<string>("cells.background.lightDefault", "#E1E1E166");
      dark = config.get<string>("cells.background.darkDefault", "#40404066");
    }

    this.enabled_ = backgroundOption !== CellBackgroundColor.off;
    this.cellOptionsBackground_ = config.get<boolean>("cells.options.background", true);
    this.delayMs_ = config.get("cells.background.delay", 250);


    if (this.backgroundDecoration_) {
      this.backgroundDecoration_.dispose();
    }
    this.backgroundDecoration_ = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      light: {
        backgroundColor: light,
      },
      dark: {
        backgroundColor: dark,
      },
    });

    if (this.inlineBackgroundDecoration_) {
      this.inlineBackgroundDecoration_.dispose();
    }
    this.inlineBackgroundDecoration_ = vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      light: {
        backgroundColor: light,
      },
      dark: {
        backgroundColor: dark,
      }
    });
  }

  private enabled_ = true;
  private cellOptionsBackground_ = true;
  private backgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private inlineBackgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private delayMs_ = 250;
}

const highlightingConfig = new HiglightingConfig();
