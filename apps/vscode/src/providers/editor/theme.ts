/*
 * theme.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Resolve the active VS Code color theme and the languages/grammars
 * contributed by installed extensions so that the visual editor's code
 * cells can be highlighted exactly as the source editor would be.
 *
 * Reference: https://github.com/quarto-dev/quarto/pull/772
 * Reference: https://github.com/microsoft/vscode/issues/32813#issuecomment-524174937
 */

import path from "node:path";
import { readFileSync } from "node:fs";

// (esm entry point: the umd one uses a dynamic require that esbuild can't bundle)
import { parse as parseJsonc } from "jsonc-parser/lib/esm/main.js";

import { ColorThemeKind, extensions, TextDocument, window, workspace } from "vscode";

import {
  CodeViewColorTheme,
  CodeViewEditorFont,
  CodeViewGrammar,
  CodeViewLanguage,
  CodeViewTokenColor
} from "editor-types";

interface ThemeContribution {
  id?: string;
  label?: string;
  uiTheme?: string;
  path: string;
}

interface GrammarContribution {
  language?: string;
  scopeName: string;
  path: string;
}

interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions?: string[];
  configuration?: string;
}

interface ThemeJson {
  include?: string;
  colors?: Record<string, string>;
  tokenColors?: CodeViewTokenColor[] | string;
}

/**
 * Candidate names for the active color theme. When vscode auto-detects the
 * OS color scheme the active theme is one of the preferred*ColorTheme
 * settings rather than workbench.colorTheme, so we try those first.
 */
export function activeColorThemeNames(): string[] {
  const workbench = workspace.getConfiguration("workbench");
  const win = workspace.getConfiguration("window");
  const names: Array<string | undefined> = [];
  const kind = window.activeColorTheme.kind;
  if (win.get<boolean>("autoDetectHighContrast", true)) {
    if (kind === ColorThemeKind.HighContrast) {
      names.push(workbench.get<string>("preferredHighContrastColorTheme"));
    } else if (kind === ColorThemeKind.HighContrastLight) {
      names.push(workbench.get<string>("preferredHighContrastLightColorTheme"));
    }
  }
  if (win.get<boolean>("autoDetectColorScheme", false)) {
    if (kind === ColorThemeKind.Dark) {
      names.push(workbench.get<string>("preferredDarkColorTheme"));
    } else if (kind === ColorThemeKind.Light) {
      names.push(workbench.get<string>("preferredLightColorTheme"));
    }
  }
  names.push(workbench.get<string>("colorTheme"));
  return names.filter((name): name is string => !!name);
}

/**
 * Resolve the active color theme to its colors and token color rules (with
 * included themes merged in). Returns undefined if the theme can't be found
 * or isn't a json theme. `themeId` is the settings id of the theme currently
 * applied to the webview (if known).
 */
export function activeColorTheme(themeId?: string): CodeViewColorTheme | undefined {
  const activeKind = kindToType(window.activeColorTheme.kind);
  // the webview knows the id of the theme it is currently displayed with
  // (which during theme preview differs from the workbench.colorTheme setting)
  const names = themeId ? [themeId, ...activeColorThemeNames()] : activeColorThemeNames();
  const candidates = names
    .map(name => ({ name, contribution: findThemeContribution(name) }))
    .filter(candidate => !!candidate.contribution);
  if (candidates.length === 0) {
    return undefined;
  }

  // prefer a theme whose kind matches the active kind
  const candidate = candidates.find(candidate =>
    themeType(candidate.contribution!.theme.uiTheme) === activeKind
  ) || candidates[0];
  const { name, contribution } = candidate;

  const themePath = path.join(contribution!.extensionPath, contribution!.theme.path);
  if (path.extname(themePath).toLowerCase() !== ".json") {
    // .tmTheme (plist) themes aren't supported
    return undefined;
  }

  const theme = loadThemeJson(themePath, new Set());
  if (!theme) {
    return undefined;
  }

  return {
    name,
    type: themeType(contribution!.theme.uiTheme),
    colors: theme.colors,
    tokenColors: theme.tokenColors
  };
}

/**
 * The source editor's font settings (so code cells can use the same font)
 */
export function editorFont(document: TextDocument): CodeViewEditorFont {
  const editor = workspace.getConfiguration("editor", document.uri);
  return {
    fontFamily: editor.get<string>("fontFamily", "Menlo, Monaco, 'Courier New', monospace"),
    fontSize: editor.get<number>("fontSize", 12),
    fontWeight: String(editor.get<string | number>("fontWeight", "normal")),
    fontLigatures: editor.get<boolean | string>("fontLigatures", false),
    lineHeight: editor.get<number>("lineHeight", 0),
    letterSpacing: editor.get<number>("letterSpacing", 0)
  };
}

/**
 * Languages contributed by installed extensions (including VS Code's built-in
 * language extensions), with the scope of the grammar for each language.
 */
export function contributedLanguages(): CodeViewLanguage[] {
  const languages = new Map<string, CodeViewLanguage>();

  // languages (an id can be contributed by multiple extensions; merge them)
  for (const extension of extensions.all) {
    const contributes = extension.packageJSON?.contributes;
    const langs = contributes?.languages as LanguageContribution[] | undefined;
    for (const lang of langs || []) {
      if (!lang.id) {
        continue;
      }
      const language = languages.get(lang.id) || { id: lang.id, aliases: [], extensions: [] };
      language.aliases = unique([...language.aliases, ...(lang.aliases || [])]);
      language.extensions = unique([...language.extensions, ...(lang.extensions || [])]);
      if (lang.configuration && language.configuration === undefined) {
        const configPath = path.join(extension.extensionPath, lang.configuration);
        language.configuration = loadJsonc(configPath);
      }
      languages.set(lang.id, language);
    }
  }

  // grammars (first grammar contributed for a language wins, which is also
  // what vscode does)
  for (const extension of extensions.all) {
    const grammars = extension.packageJSON?.contributes?.grammars as GrammarContribution[] | undefined;
    for (const grammar of grammars || []) {
      if (grammar.language && grammar.scopeName) {
        const language = languages.get(grammar.language);
        if (language && !language.scopeName) {
          language.scopeName = grammar.scopeName;
        }
      }
    }
  }

  return Array.from(languages.values());
}

/**
 * The raw contents of the grammar with the given scope name (undefined if no
 * installed extension contributes a grammar for the scope)
 */
export function contributedGrammar(scopeName: string): CodeViewGrammar | undefined {
  for (const extension of extensions.all) {
    const grammars = extension.packageJSON?.contributes?.grammars as GrammarContribution[] | undefined;
    for (const grammar of grammars || []) {
      if (grammar.scopeName === scopeName) {
        const grammarPath = path.join(extension.extensionPath, grammar.path);
        try {
          return {
            scopeName,
            path: grammarPath,
            content: readFileSync(grammarPath, "utf8")
          };
        } catch {
          // fall through to other contributions
        }
      }
    }
  }
  return undefined;
}

function findThemeContribution(name: string) {
  for (const extension of extensions.all) {
    const themes = extension.packageJSON?.contributes?.themes as ThemeContribution[] | undefined;
    const theme = themes?.find(theme => themeNameMatches(theme, name));
    if (theme) {
      return { extensionPath: extension.extensionPath, theme };
    }
  }
  return undefined;
}

// vscode's settings id for a theme is its id (or label if it has no id);
// built-in themes are also addressable with a "Default " prefix
function themeNameMatches(theme: ThemeContribution, name: string) {
  const candidates = [theme.id, theme.label].filter((value): value is string => !!value);
  return candidates.some(candidate =>
    candidate === name ||
    `Default ${candidate}` === name ||
    candidate === name.replace(/^Default /, "")
  );
}

function kindToType(kind: ColorThemeKind): CodeViewColorTheme["type"] {
  switch (kind) {
    case ColorThemeKind.Light:
      return "light";
    case ColorThemeKind.HighContrast:
      return "hcDark";
    case ColorThemeKind.HighContrastLight:
      return "hcLight";
    default:
      return "dark";
  }
}

function themeType(uiTheme?: string): CodeViewColorTheme["type"] {
  switch (uiTheme) {
    case "vs":
      return "light";
    case "vs-dark":
      return "dark";
    case "hc-black":
      return "hcDark";
    case "hc-light":
      return "hcLight";
    default:
      return kindToType(window.activeColorTheme.kind);
  }
}

// load a theme and the themes it includes (included themes are applied
// first so the including theme's rules take precedence)
function loadThemeJson(themePath: string, visited: Set<string>)
  : { colors: Record<string, string>, tokenColors: CodeViewTokenColor[] } | undefined {

  if (visited.has(themePath)) {
    return undefined;
  }
  visited.add(themePath);

  const theme = loadJsonc(themePath) as ThemeJson | undefined;
  if (!theme) {
    return undefined;
  }

  let colors: Record<string, string> = {};
  let tokenColors: CodeViewTokenColor[] = [];

  if (theme.include) {
    const included = loadThemeJson(path.join(path.dirname(themePath), theme.include), visited);
    if (included) {
      colors = included.colors;
      tokenColors = included.tokenColors;
    }
  }

  colors = { ...colors, ...(theme.colors || {}) };
  if (Array.isArray(theme.tokenColors)) {
    tokenColors = [...tokenColors, ...theme.tokenColors];
  }

  return { colors, tokenColors };
}

function loadJsonc(filePath: string): unknown {
  try {
    return parseJsonc(readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
