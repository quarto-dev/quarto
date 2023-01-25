/*
 * theme.ts
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


import { EditorUIStore, readPrefsApi } from "editor-ui";
import { defaultTheme } from "editor/src/editor/editor-theme";

export function applyDarkMode(store: EditorUIStore) {
  const prefs = readPrefsApi(store);
  const root = document.getElementById('root');
  if (prefs.darkMode) {
    root?.classList.add('bp4-dark');  
  } else {
    root?.classList.remove('bp4-dark');
  }
}

export function editorThemeFromVSCode(fontSizePx?: number) {

  // start with default
  const theme = defaultTheme();

  // get vscode theme colors
  const colors: Record<string,string> = {};
  Object.values(document.getElementsByTagName('html')[0].style)
    .forEach((rv) => {
      colors[rv] = document
        .getElementsByTagName('html')[0]
        .style.getPropertyValue(rv)
    }
  );

  theme.darkMode = document.body.classList.contains('vscode-dark');
  theme.solarizedMode = (document.body.getAttribute('data-vscode-theme-name') || '').includes('Solarized Light');
  theme.cursorColor = colors["--vscode-editorCursor-foreground"];
  theme.selectionColor = colors["--vscode-editor-selectionBackground"];
  theme.nodeSelectionColor = colors["--vscode-notebook-focusedCellBorder"];
  theme.backgroundColor = colors["--vscode-editor-background"];
  theme.metadataBackgroundColor =  theme.backgroundColor;
  theme.chunkBackgroundColor = colors["--vscode-notebook-cellEditorBackground"];
  theme.spanBackgroundColor = theme.chunkBackgroundColor;
  theme.divBackgroundColor = theme.chunkBackgroundColor;
  theme.commentColor = colors["--vscode-editor-foreground"];
  theme.commentBackgroundColor = colors["--vscode-merge-incomingContentBackground"];
  theme.textColor = colors["--vscode-editor-foreground"];
  theme.surfaceWidgetTextColor = theme.gutterTextColor;
  theme.lightTextColor = colors["--vscode-breadcrumb-foreground"];
  theme.linkTextColor = colors["--vscode-textLink-foreground"];
  theme.placeholderTextColor = colors["--vscode-editorGhostText-foreground"];
  theme.invisibleTextColor = colors["--vscode-editorWhitespace-foreground"];
  theme.markupTextColor = theme.darkMode 
    ? colors["--vscode-charts-orange"] 
    : colors["--vscode-editorInfo-foreground"];
  theme.findTextBackgroundColor = colors["--vscode-editor-foldBackground"];
  theme.findTextBorderColor = "transparent";
  theme.borderBackgroundColor = theme.darkMode 
    ? colors["--vscode-titleBar-activeBackground"]
    : colors["--vscode-titleBar-inactiveBackground"];
  theme.gutterBackgroundColor = theme.borderBackgroundColor;
  theme.gutterTextColor = colors["--vscode-editorWidget-foreground"];
  theme.blockBorderColor = theme.darkMode 
    ? colors["--vscode-sideBarSectionHeader-border"]
    : colors["--vscode-notebook-cellBorderColor"];
  theme.focusOutlineColor = colors["--vscode-focusBorder"];
  theme.paneBorderColor = colors["--vscode-sideBarSectionHeader-border"];
  theme.fixedWidthFont = colors["--vscode-editor-font-family"];
  theme.proportionalFont = '"Lucida Sans", "DejaVu Sans", "Lucida Grande", "Segoe UI", Verdana, Helvetica, sans-serif';

  // if not font size is specified then compute it from vscode css
  if (!fontSizePx) {
    const editorFontSize = colors["--vscode-editor-font-size"];
    const match = editorFontSize.match(/(\d+)px/);
    fontSizePx = match ? parseInt(match[1]) : 12;
  }
  const fontSizePt = Math.round(fontSizePx / 1.333) ;
  theme.fixedWidthFontSizePt = fontSizePt;
  theme.proportionalFontSizePt = fontSizePt + 1;

  return theme;


}