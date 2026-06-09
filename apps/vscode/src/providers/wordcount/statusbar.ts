/*
 * statusbar.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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
  Event,
  ExtensionContext,
  StatusBarAlignment,
  TextDocument,
  window,
  workspace,
} from "vscode";

import { MarkdownEngine } from "../../markdown/engine";
import { isQuartoDoc } from "../../core/doc";
import { VisualEditorProvider } from "../editor/editor";
import { VisualEditorSelection } from "../../api";
import { countDocument, countText } from "./count";
import {
  affectsWordCount,
  formatWordCount,
  wordCountEnabled,
  wordCountOptions,
} from "./config";

export function activateWordCountStatusBar(
  context: ExtensionContext,
  engine: MarkdownEngine,
  onDidChangeVisualEditorSelection: Event<VisualEditorSelection>
) {
  const statusItem = window.createStatusBarItem(
    "quarto.wordCount",
    StatusBarAlignment.Right,
    100
  );
  statusItem.name = "Quarto Word Count";
  context.subscriptions.push(statusItem);

  // last reported visual editor selection text, keyed by document uri
  const visualSelection = new Map<string, string>();

  // cache the document total (keyed by uri@version) so that selection / cursor
  // changes don't re-count the whole document on every event
  let totalCache: { key: string; total: number } | undefined;
  const documentTotal = (document: TextDocument): number => {
    const key = `${document.uri.toString()}@${document.version}`;
    if (totalCache?.key !== key) {
      const tokens = engine.parse(document);
      totalCache = { key, total: countDocument(tokens, document.getText(), wordCountOptions()) };
    }
    return totalCache.total;
  };

  const update = () => {
    if (!wordCountEnabled()) {
      statusItem.hide();
      return;
    }

    // resolve the active quarto document and its current selection (if any),
    // preferring an active source editor and falling back to a visual editor
    let document: TextDocument | undefined;
    let selectedText = "";

    const textEditor = window.activeTextEditor;
    if (textEditor && isQuartoDoc(textEditor.document)) {
      document = textEditor.document;
      selectedText = textEditor.selection.isEmpty
        ? ""
        : document.getText(textEditor.selection);
    } else {
      const visualEditor = VisualEditorProvider.activeEditor();
      if (visualEditor && isQuartoDoc(visualEditor.document)) {
        document = visualEditor.document;
        selectedText = visualSelection.get(document.uri.toString()) || "";
      }
    }

    if (!document) {
      statusItem.hide();
      return;
    }

    const total = documentTotal(document);

    if (selectedText) {
      const selected = countText(selectedText);
      statusItem.text = `${selected.toLocaleString()} of ${formatWordCount(total)}`;
    } else {
      statusItem.text = formatWordCount(total);
    }
    statusItem.show();
  };

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(() => update()),
    window.tabGroups.onDidChangeTabs(() => update()),
    window.onDidChangeTextEditorSelection(() => update()),
    workspace.onDidChangeTextDocument((e) => {
      const active = activeDocumentUri();
      if (active && e.document.uri.toString() === active) {
        update();
      }
    }),
    onDidChangeVisualEditorSelection((e) => {
      visualSelection.set(e.uri.toString(), e.selectedText);
      update();
    }),
    workspace.onDidChangeConfiguration((e) => {
      if (affectsWordCount((section) => e.affectsConfiguration(section))) {
        totalCache = undefined; // includeCodeCells may have changed
        update();
      }
    })
  );

  update();
}

function activeDocumentUri(): string | undefined {
  const textEditor = window.activeTextEditor;
  if (textEditor && isQuartoDoc(textEditor.document)) {
    return textEditor.document.uri.toString();
  }
  const visualEditor = VisualEditorProvider.activeEditor();
  if (visualEditor && isQuartoDoc(visualEditor.document)) {
    return visualEditor.document.uri.toString();
  }
  return undefined;
}
