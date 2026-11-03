/*
 * theme.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Apply the active VS Code color theme (provided by the host) to monaco, and
 * apply per-editor font and background settings.
 */

import { PrefsChangedEvent, ThemeChangedEvent } from "editor";
import { CodeViewEditorFont } from "editor-types";

import { Behavior, BehaviorContext, CodeEditor } from ".";
import { activeThemeColors, applyColorTheme, initTextMate } from "../textmate";

// the color theme is shared by all editors, so the theme is fetched/applied
// once per change and then every editor is notified to reconfigure itself
let themeRequest: Promise<void> | undefined;
let themeRequestedAt = 0;
const themeListeners = new Set<VoidFunction>();

// the source editor's font settings (shared by all editors)
let editorFont: CodeViewEditorFont | undefined;
let fontRequest: Promise<void> | undefined;

function requestEditorFont(context: BehaviorContext, force: boolean): Promise<void> {
  if (!fontRequest || force) {
    const codeview = context.pmContext.ui.codeview;
    fontRequest = (codeview ? codeview.codeViewEditorFont() : Promise.resolve(undefined))
      .then(font => { editorFont = font; })
      .catch(error => console.error("Error reading editor font", error))
      .then(() => themeListeners.forEach(listener => listener()));
  }
  return fontRequest;
}

// vscode stamps the webview body with the id of the theme it is currently
// displayed with (updated live, including during theme preview)
function webviewThemeId(): string | undefined {
  return document.body.dataset.vscodeThemeId || document.body.dataset.vscodeThemeName || undefined;
}

function webviewDarkMode(fallback: boolean): boolean {
  const kind = document.body.dataset.vscodeThemeKind;
  if (kind) {
    return kind === "vscode-dark" || kind === "vscode-high-contrast";
  }
  return fallback;
}

function requestColorTheme(context: BehaviorContext, force: boolean): Promise<void> {
  // every editor observes the same theme change event, so coalesce their
  // forced requests into one
  const now = Date.now();
  if (!themeRequest || (force && (now - themeRequestedAt) > 100)) {
    themeRequestedAt = now;
    const codeview = context.pmContext.ui.codeview;
    const darkMode = webviewDarkMode(context.pmContext.theme().darkMode);
    themeRequest = initTextMate(codeview)
      .then(() => codeview?.codeViewColorTheme(webviewThemeId()))
      .then(theme => applyColorTheme(theme, darkMode))
      .catch(error => {
        console.error("Error applying color theme", error);
        applyColorTheme(undefined, darkMode);
      })
      .then(() => themeListeners.forEach(listener => listener()));
  }
  return themeRequest;
}

// re-apply the theme whenever vscode changes the theme attributes on the body
let bodyObserver: MutationObserver | undefined;
function observeWebviewTheme(context: BehaviorContext) {
  if (!bodyObserver) {
    bodyObserver = new MutationObserver(() => {
      requestColorTheme(context, true);
    });
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-vscode-theme-id", "data-vscode-theme-name", "data-vscode-theme-kind"]
    });
  }
}

export function themeBehavior(context: BehaviorContext): Behavior {

  let unsubscribe: VoidFunction;

  const chunkBackground = !!context.options.classes?.includes("pm-chunk-background-color");

  const configureEditor = (editor: CodeEditor) => {

    // fonts (the same settings the source editor uses)
    if (editorFont) {
      editor.updateOptions({
        fontFamily: editorFont.fontFamily,
        fontSize: editorFont.fontSize,
        fontWeight: editorFont.fontWeight,
        fontLigatures: editorFont.fontLigatures,
        lineHeight: editorFont.lineHeight,
        letterSpacing: editorFont.letterSpacing
      });
    } else {
      const editorTheme = context.pmContext.theme();
      editor.updateOptions({
        fontFamily: editorTheme.fixedWidthFont,
        fontSize: Math.round(editorTheme.fixedWidthFontSizePt * 96 / 72)
      });
    }

    // background (monaco's theme is global, so per-editor backgrounds are
    // applied via a css variable on our container)
    const colors = activeThemeColors();
    const background = chunkBackground
      ? (colors["notebook.cellEditorBackground"] || colors["editor.background"])
      : colors["editor.background"];
    if (background) {
      context.dom.style.setProperty("--pm-code-background", background);
      context.dom.classList.add("pm-monaco-editor-background");
    } else {
      context.dom.style.removeProperty("--pm-code-background");
      context.dom.classList.remove("pm-monaco-editor-background");
    }
  };

  return {
    init: (_pmNode, editor) => {
      const listener = () => configureEditor(editor);
      themeListeners.add(listener);
      configureEditor(editor);
      observeWebviewTheme(context);
      requestColorTheme(context, false).then(listener);
      requestEditorFont(context, false).then(listener);
      const unsubscribeTheme = context.pmContext.events.subscribe(ThemeChangedEvent, () => {
        requestColorTheme(context, true);
      });
      const unsubscribePrefs = context.pmContext.events.subscribe(PrefsChangedEvent, () => {
        requestEditorFont(context, true);
      });
      unsubscribe = () => {
        unsubscribeTheme();
        unsubscribePrefs();
        themeListeners.delete(listener);
      };
    },
    cleanup: () => unsubscribe?.()
  };
}
