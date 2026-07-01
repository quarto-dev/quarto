/*
 * background.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 * Copyright (c) [2021] [Chris Bain] (https://github.com/baincd/vscode-markdown-color-plus/)
 */


import * as vscode from "vscode";

import { isQuartoDoc, kQuartoDocSelector } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { isExecutableLanguageBlock } from "quarto-core";
import { vscRange } from "../core/range";
import { createThrottle } from "../core/throttle";

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

  if (highlightingConfig.enabled()) {

    // find code blocks
    const tokens = engine.parse(editor.document);
    for (const block of tokens.filter(isExecutableLanguageBlock)) {
      blockRanges.push(vscRange(block.range));
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
}

function clearEditorHighlightDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(highlightingConfig.backgroundDecoration(), []);
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
  private backgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private inlineBackgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private delayMs_ = 250;
}

const highlightingConfig = new HiglightingConfig();
