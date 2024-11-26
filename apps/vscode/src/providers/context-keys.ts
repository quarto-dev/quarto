/*
 * context-keys.ts
 *
 * Copyright (C) 2024 by Posit Software, PBC
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
import debounce from "lodash.debounce";

import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { mainLanguage } from "../vdoc/vdoc";

const debounceOnDidChangeDocumentMs = 250;

export function activateContextKeySetter(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
) {

  // set context keys when docs are opened
  vscode.workspace.onDidOpenTextDocument(
    (doc) => {
      if (doc === vscode.window.activeTextEditor?.document) {
        if (isQuartoDoc(doc)) {
          setContextKeys(vscode.window.activeTextEditor, engine);
        }
      }
    },
    null,
    context.subscriptions
  );

  // set context keys when active text editor changes
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        setContextKeys(editor, engine);
      }
    },
    null,
    context.subscriptions
  );

  // set context keys on changes to the document (if it's active)
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        debounce(
          () => setContextKeys(activeEditor, engine),
          debounceOnDidChangeDocumentMs
        )();
      }
    },
    null,
    context.subscriptions
  );
}

function setContextKeys(editor: vscode.TextEditor, engine: MarkdownEngine) {
  if (!editor || !isQuartoDoc(editor.document)) {
    return;
  }

  // expose main language for use in keybindings, etc
  const tokens = engine.parse(editor.document);
  const language = mainLanguage(tokens);
  vscode.commands.executeCommand(
    'setContext',
    'quarto.document.languageId',
    language?.ids[0]);
}
