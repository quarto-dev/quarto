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


import { defaultTheme } from "editor/src/editor/editor-theme";

export function editorThemeFromVSCode() {

  // start with default
  const theme = defaultTheme();

  // get vscode theme colors
  const colors: Record<string,string> = {};
  Object.values(document.getElementsByTagName('html')[0].style)
    .forEach((rv) => {
      colors[rv] = document
        .getElementsByTagName('html')[0]
        .style.getPropertyValue(rv)
    });

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
  theme.commentColor = '#3c4c72';
  theme.commentBackgroundColor = '#FFECCB';
  theme.gutterBackgroundColor = '#f0f0f0';
  theme.gutterTextColor = '#333';
  theme.textColor = colors["--vscode-editor-foreground"];
  theme.surfaceWidgetTextColor = colors["--vscode-editorWidget-foreground"];
  theme.lightTextColor = colors["--vscode-breadcrumb-foreground"];
  theme.linkTextColor = colors["--vscode-textLink-foreground"];
  theme.placeholderTextColor = colors["--vscode-editorGhostText-foreground"];
  theme.invisibleTextColor = colors["--vscode-editorWhitespace-foreground"];
  theme.markupTextColor = 'rgb(185, 6, 144)';
  theme.findTextBackgroundColor = 'rgb(250, 250, 255)';
  theme.findTextBorderColor = 'rgb(200, 200, 250)';
  theme.borderBackgroundColor = colors["--vscode-titleBar-inactiveBackground"];
  theme.blockBorderColor = colors["--vscode-notebook-cellBorderColor"];
  theme.focusOutlineColor = '#5d84cd';
  theme.paneBorderColor = colors["--vscode-sideBarSectionHeader-border"];
  theme.fixedWidthFont = `"${colors["--vscode-editor-font-family"]}"`;
  theme.fixedWidthFontSizePt = 10;
  theme.proportionalFont =  '"Lucida Sans", "DejaVu Sans", "Lucida Grande", "Segoe UI", Verdana, Helvetica, sans-serif';
  theme.proportionalFontSizePt = 10;

  // TODO: theme.code

  return theme;


}