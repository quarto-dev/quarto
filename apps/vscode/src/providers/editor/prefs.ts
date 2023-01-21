/*
 * prefs.ts
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

import { Disposable, Uri, workspace } from "vscode";

import { Prefs, PrefsServer } from "editor-types";

import { prefsServer } from "editor-server";

const kEditorAutoClosingBrackets = "editor.autoClosingBrackets";
const kEditorRenderWhitespace = "editor.renderWhitespace";
const kEditorInsertSpaces = "editor.insertSpaces";
const kEditorTabSize = "editor.tabSize";
const kEditorSelectionHighlight = "editor.selectionHighlight";
const kEditorCursorBlinking = "editor.cursorBlinking";
const kQuartoVisualLineNumbers = "quarto.visual.lineNumbers";

const kMonitoredConfigurations = [
  kEditorAutoClosingBrackets,
  kEditorRenderWhitespace,
  kEditorInsertSpaces,
  kEditorTabSize,
  kEditorSelectionHighlight,
  kEditorCursorBlinking,
  kQuartoVisualLineNumbers
];

export function vscodePrefsServer(
  uri: Uri | undefined,
  onPrefsChanged: (prefs: Prefs) => void
) : [PrefsServer, Disposable]  {

  const server = prefsServer();

  const getPrefs = async () : Promise<Prefs> => {
    
    const configuration = workspace.getConfiguration(undefined, uri);
     
    const prefs = { ...(await server.getPrefs()), 
      spacesForTab: configuration.get<boolean>(kEditorInsertSpaces, true),
      tabWidth: configuration.get<number>(kEditorTabSize, 4),
      autoClosingBrackets: configuration.get(kEditorAutoClosingBrackets) !== "never",
      highlightSelectedWord: configuration.get<boolean>(kEditorSelectionHighlight, true),
      lineNumbers: configuration.get<boolean>(kQuartoVisualLineNumbers, true),
      showWhitespace: configuration.get(kEditorRenderWhitespace) === "all",
      blinkingCursor: configuration.get(kEditorCursorBlinking, "solid") !== "solid",
    };
    return prefs;
  };

  const unsubscribe = workspace.onDidChangeConfiguration(async (e) => {
    if (kMonitoredConfigurations.some(config => e.affectsConfiguration(config))) {
      onPrefsChanged(await getPrefs());
    }
  });

  return [
    {
      getPrefs,
      setPrefs: async (prefs: Prefs) : Promise<void> => {
        server.setPrefs(prefs);
      }
    }, 
    unsubscribe
  ];
}
