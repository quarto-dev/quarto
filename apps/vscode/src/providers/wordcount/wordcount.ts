/*
 * wordcount.ts
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
  ConfigurationTarget,
  Event,
  ExtensionContext,
  commands,
  languages,
  workspace,
} from "vscode";

import { MarkdownEngine } from "../../markdown/engine";
import { kQuartoDocSelector } from "../../core/doc";
import { VisualEditorSelection } from "../../api";
import { WordCountCodeLensProvider } from "./codelens";
import { activateWordCountStatusBar } from "./statusbar";
import { affectsWordCount, wordCountEnabled } from "./config";

export function activateWordCount(
  context: ExtensionContext,
  engine: MarkdownEngine,
  onDidChangeVisualEditorSelection: Event<VisualEditorSelection>
) {
  // per-section code lens (source mode)
  const codeLensProvider = new WordCountCodeLensProvider(engine);
  context.subscriptions.push(codeLensProvider);
  context.subscriptions.push(
    languages.registerCodeLensProvider(kQuartoDocSelector, codeLensProvider)
  );

  // document total + selection (status bar, both modes)
  activateWordCountStatusBar(context, engine, onDidChangeVisualEditorSelection);

  // refresh the code lens when the configuration changes (status bar refreshes
  // itself; the editor badges follow the prefs channel)
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (affectsWordCount((section) => e.affectsConfiguration(section))) {
        codeLensProvider.refresh();
      }
    })
  );

  // toggle command
  context.subscriptions.push(
    commands.registerCommand("quarto.toggleWordCount", async () => {
      await workspace
        .getConfiguration("quarto")
        .update("wordCount.enabled", !wordCountEnabled(), ConfigurationTarget.Global);
    })
  );
}
