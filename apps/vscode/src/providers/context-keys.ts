/*
 * context-keys.ts
 *
 * Copyright (C) 2024-2026 by Posit Software, PBC
 */

import * as vscode from "vscode";
import debounce from "lodash.debounce";

import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { mainLanguage } from "../vdoc/vdoc";
import { isQuartoShinyDoc } from "./preview/preview-util";
import { workspace } from "vscode";
import { VisualEditorProvider } from "./editor/editor";

const debounceOnDidChangeDocumentMs = 250;

// state for quarto.editor.type context key
let quartoEditorType: 'quarto' | 'quarto-shiny' | undefined = undefined;

// state for quarto.editor.renderOnSave override
// this is only defined when the user has changed the value at runtime
let renderOnSaveOverride: boolean | undefined = undefined;

// state for quarto.editor.renderOnSaveShiny override
// this is only defined when the user has changed the value at runtime
let renderOnSaveShinyOverride: boolean | undefined = undefined;

export function activateContextKeySetter(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
) {
  // set the initial context keys
  setEditorContextKeys(vscode.window.activeTextEditor?.document, engine);
  setLanguageContextKeys(vscode.window.activeTextEditor?.document, engine);

  // register for quarto.render.renderOnSave or quarto.render.renderOnSaveShiny configuration change notification
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    // if the change affects quarto.render.renderOnSave or quarto.render.renderOnSaveShiny, set the editor context keys.
    if (event.affectsConfiguration('quarto.render.renderOnSave') || event.affectsConfiguration('quarto.render.renderOnSaveShiny')) {
      const document = vscode.window.activeTextEditor?.document ?? VisualEditorProvider.activeEditor()?.document;
      setEditorContextKeys(document, engine);
    }
  }));

  // set context keys when active text editor changes
  vscode.window.onDidChangeActiveTextEditor(activeTextEditor => {
    setEditorContextKeys(activeTextEditor?.document, engine);
    setLanguageContextKeys(activeTextEditor?.document, engine);
  },
    null,
    context.subscriptions
  );

  // set context keys when a visual editor becomes active (custom editors
  // don't fire onDidChangeActiveTextEditor)
  context.subscriptions.push(
    VisualEditorProvider.onDidChangeActiveEditor()(editor => {
      setEditorContextKeys(editor.document, engine);
      setLanguageContextKeys(editor.document, engine);
    })
  );

  // set context keys on changes to the document (if it's active)
  vscode.workspace.onDidChangeTextDocument(event => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      // TODO: this debounce is being created and called immediately, which is not correct.
      debounce(
        () => {
          setEditorContextKeys(activeEditor.document, engine);
          setLanguageContextKeys(activeEditor.document, engine);
        },
        debounceOnDidChangeDocumentMs
      )();
    }
  },
    null,
    context.subscriptions
  );
}

// gets render on save
export function getRenderOnSave() {
  return renderOnSaveOverride === undefined
    ? readRenderOnSaveConfiguration()
    : renderOnSaveOverride;
}

// gets render on save shiny
export function getRenderOnSaveShiny() {
  return renderOnSaveShinyOverride === undefined
    ? readRenderOnSaveShinyConfiguration()
    : renderOnSaveShinyOverride;
};

// toggles render on save override
export function toggleRenderOnSaveOverride() {
  // toggle the render on save override based on the editor type (quarto or quarto-shiny)
  if (quartoEditorType === 'quarto') {
    // if this is the first override, read the quarto.render.renderOnSave configuration
    if (renderOnSaveOverride === undefined) {
      renderOnSaveOverride = readRenderOnSaveConfiguration();
    }

    // toggle the render on save override
    renderOnSaveOverride = !renderOnSaveOverride;
    vscode.commands.executeCommand<boolean>('setContext', 'quarto.editor.renderOnSave', renderOnSaveOverride);
  } else if (quartoEditorType === 'quarto-shiny') {
    // if this is the first override, read the quarto.render.renderOnSaveShiny configuration
    if (renderOnSaveShinyOverride === undefined) {
      renderOnSaveShinyOverride = readRenderOnSaveShinyConfiguration();
    }

    // toggle the render on save override
    renderOnSaveShinyOverride = !renderOnSaveShinyOverride;
    vscode.commands.executeCommand<boolean>('setContext', 'quarto.editor.renderOnSaveShiny', renderOnSaveShinyOverride);
  }
}

// sets editor context keys
function setEditorContextKeys(document: vscode.TextDocument | undefined, engine: MarkdownEngine) {
  // if a Quarto doc is active, set the editor context keys
  if (isQuartoDoc(document)) {
    // set the quarto.editor.type context key
    quartoEditorType = !isQuartoShinyDoc(engine, document)
      ? 'quarto'
      : 'quarto-shiny';
    vscode.commands.executeCommand<string>(
      'setContext',
      'quarto.editor.type',
      quartoEditorType
    );

    // set the quarto.editor.renderOnSave context key
    const renderOnSave = renderOnSaveOverride === undefined
      ? readRenderOnSaveConfiguration()
      : renderOnSaveOverride;
    vscode.commands.executeCommand<string>(
      'setContext',
      'quarto.editor.renderOnSave',
      renderOnSave
    );

    // set the quarto.editor.renderOnSaveShiny context key
    const renderOnSaveShiny = renderOnSaveShinyOverride === undefined ?
      readRenderOnSaveShinyConfiguration() :
      renderOnSaveShinyOverride;
    vscode.commands.executeCommand<string>(
      'setContext',
      'quarto.editor.renderOnSaveShiny',
      renderOnSaveShiny
    );
  }
}

function setLanguageContextKeys(document: vscode.TextDocument | undefined, engine: MarkdownEngine) {
  if (!document || !isQuartoDoc(document)) {
    return;
  }

  // expose main language for use in keybindings, etc
  const tokens = engine.parse(document);
  const language = mainLanguage(tokens);
  vscode.commands.executeCommand(
    'setContext',
    'quarto.document.languageId',
    language?.ids[0]);
}

// reads the quarto.render.renderOnSave configuration.
function readRenderOnSaveConfiguration() {
  return workspace.getConfiguration("quarto").get<boolean>("render.renderOnSave", false);
}

// reads the quarto.render.renderOnSaveShiny configuration.
function readRenderOnSaveShinyConfiguration() {
  return workspace.getConfiguration("quarto").get<boolean>("render.renderOnSaveShiny", true);
}
