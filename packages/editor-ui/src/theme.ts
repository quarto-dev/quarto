/*
 * solarized.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import {
  webLightTheme,
  webDarkTheme
} from "@fluentui/react-components";

import { EditorTheme } from "editor";
import { isDarkThemeActive, setDarkThemeActive } from "ui-widgets";

// detect solarized theme using various hueristics
export function isSolarizedThemeActive() {
  return (document.body.getAttribute('data-vscode-theme-name') || '').includes('Solarized Light');
}

export function setEditorTheme(theme: EditorTheme) { 
  setDarkThemeActive(theme.darkMode);
}

export function fluentTheme() {
  if (isDarkThemeActive()) {
    return webDarkTheme;
  } else {
    return webLightTheme;
  }
}

