/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) [2021] [Chris Bain] (https://github.com/baincd/vscode-markdown-color-plus/)
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import debounce from "lodash.debounce";

import { isQuartoDoc, kQuartoDocSelector } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { isExecutableLanguageBlock } from "../markdown/language";

export function activateBackgroundHighlighter(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
) {
  // read config and monitor it for changes
  highlightingConfig.sync();
  vscode.workspace.onDidChangeConfiguration(
    () => {
      highlightingConfig.sync();
      triggerUpdateAllEditorsDecorations(engine);
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
          triggerUpdateActiveEditorDecorations(
            vscode.window.activeTextEditor,
            engine,
            highlightingConfig.delayMs()
          );
        }
      }
    },
    null,
    context.subscriptions
  );

  // update highlighting when visible text editors change
  vscode.window.onDidChangeVisibleTextEditors(
    (_editors) => {
      triggerUpdateAllEditorsDecorations(engine);
    },
    null,
    context.subscriptions
  );

  // update highlighting on changes to the document
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        triggerUpdateActiveEditorDecorations(
          vscode.window.activeTextEditor,
          engine,
          highlightingConfig.delayMs(),
          true,
          event.contentChanges.length == 1
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
          triggerUpdateActiveEditorDecorations(
            vscode.window.activeTextEditor,
            engine,
            highlightingConfig.delayMs(),
            true,
            position,
            token
          );
        }
        return [];
      },
    })
  );

  // highlight all editors at activation time
  triggerUpdateAllEditorsDecorations(engine);
}

function triggerUpdateActiveEditorDecorations(
  editor: vscode.TextEditor,
  engine: MarkdownEngine,
  delay: number,
  immediate?: boolean,
  pos?: vscode.Position,
  token?: vscode.CancellationToken
) {
  debounce(
    () => setEditorHighlightDecorations(editor, engine, pos, token),
    delay,
    {
      leading: !!immediate,
    }
  )();
}

function triggerUpdateAllEditorsDecorations(engine: MarkdownEngine) {
  debounce(async () => {
    for (const editor of vscode.window.visibleTextEditors) {
      await setEditorHighlightDecorations(editor, engine);
    }
  }, highlightingConfig.delayMs())();
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
  const highlightedRanges: vscode.Range[] = [];

  if (highlightingConfig.enabled()) {
    const tokens = await engine.parse(editor.document);
    for (const block of tokens.filter(isExecutableLanguageBlock)) {
      if (block.map) {
        highlightedRanges.push(
          new vscode.Range(block.map[0], 0, block.map[1] - 1, 0)
        );
      }
    }
  }

  // set highlights (could be none if we highlighting isn't enabled)
  editor.setDecorations(
    highlightingConfig.backgroundDecoration(),
    highlightedRanges
  );
}

function clearEditorHighlightDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(highlightingConfig.backgroundDecoration(), []);
}

class HiglightingConfig {
  constructor() {}

  public enabled() {
    return this.enabled_;
  }

  public backgroundDecoration() {
    return this.backgroundDecoration_!;
  }

  public delayMs() {
    return this.delayMs_;
  }

  public sync() {
    const config = vscode.workspace.getConfiguration("quarto");

    this.enabled_ = config.get("cells.background.enabled", true);
    this.delayMs_ = config.get("cells.background.delay", 250);

    if (this.backgroundDecoration_) {
      this.backgroundDecoration_.dispose();
    }
    this.backgroundDecoration_ = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      light: {
        backgroundColor: config.get("cells.background.light", "#E1E1E166"),
      },
      dark: {
        backgroundColor: config.get("cells.background.dark", "#40404066"),
      },
    });
  }

  private enabled_ = true;
  private backgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private delayMs_ = 250;
}

const highlightingConfig = new HiglightingConfig();
