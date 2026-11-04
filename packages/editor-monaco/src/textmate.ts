/*
 * textmate.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * TextMate tokenization and VS Code color themes for Monaco. The grammars,
 * languages, and the active color theme all come from the host (the vscode
 * extension), so code cells are highlighted exactly as the source editor is.
 */

/// <reference types="vite/client" />

import * as vsctm from "vscode-textmate";
import * as onig from "vscode-oniguruma";
import onigWasmUrl from "vscode-oniguruma/release/onig.wasm?url";

import {
  CodeViewColorTheme,
  CodeViewLanguage,
  CodeViewServer
} from "editor-types";

import { monaco } from "./monaco";

const kThemeName = "vscode-active";

let registry: vsctm.Registry | undefined;
let languages: CodeViewLanguage[] = [];
let initPromise: Promise<void> | undefined;
let themeColors: Record<string, string> = {};

/**
 * One time initialization of the textmate registry and registration of the
 * host's languages with monaco. Safe to call repeatedly (returns the same
 * promise). Resolves (never rejects) once languages are available.
 */
export function initTextMate(codeview: CodeViewServer | undefined): Promise<void> {
  if (!initPromise) {
    initPromise = codeview
      ? doInit(codeview).catch(error => {
        console.error("Error initializing textmate tokenization", error);
      })
      : Promise.resolve();
  }
  return initPromise;
}

/**
 * Languages contributed by the host (empty until initTextMate resolves)
 */
export function contributedLanguages(): CodeViewLanguage[] {
  return languages;
}

/**
 * Workbench colors of the active color theme (empty if no theme applied)
 */
export function activeThemeColors(): Record<string, string> {
  return themeColors;
}

/**
 * Apply a VS Code color theme to monaco (all editors share the theme).
 */
export function applyColorTheme(theme: CodeViewColorTheme | undefined, darkMode: boolean) {

  if (!theme || !registry) {
    themeColors = {};
    monaco.editor.setTheme(darkMode ? "vs-dark" : "vs");
    return;
  }

  themeColors = theme.colors;

  const base = themeBase(theme.type);
  const dark = base !== "vs" && base !== "hc-light";
  const foreground = theme.colors["editor.foreground"] || (dark ? "#D4D4D4" : "#000000");
  const background = theme.colors["editor.background"] || (dark ? "#1E1E1E" : "#FFFFFF");

  // set the textmate theme (the color map it produces is what token colors
  // are encoded against)
  registry.setTheme({
    name: theme.name,
    settings: [
      { settings: { foreground: normalizeHex(foreground), background: normalizeHex(background) } },
      ...theme.tokenColors.map(rule => ({
        ...rule,
        settings: {
          ...rule.settings,
          foreground: normalizeHex(rule.settings.foreground),
          background: normalizeHex(rule.settings.background)
        }
      }))
    ]
  });
  // monaco wants null (not undefined) for the unused color id 0
  const colorMap = registry.getColorMap() as Array<string | null>;
  colorMap[0] = null;

  monaco.editor.defineTheme(kThemeName, {
    base,
    inherit: false,
    rules: [],
    colors: validColors(theme.colors),
    encodedTokensColors: colorMap as string[]
  });
  monaco.editor.setTheme(kThemeName);

  // token color ids may have changed, so re-tokenize all models
  for (const model of monaco.editor.getModels()) {
    const languageId = model.getLanguageId();
    if (languageId !== "plaintext") {
      monaco.editor.setModelLanguage(model, "plaintext");
      monaco.editor.setModelLanguage(model, languageId);
    }
  }
}

async function doInit(codeview: CodeViewServer) {

  // load oniguruma
  await onig.loadWASM(await loadOnigWasm());
  const onigLib = Promise.resolve<vsctm.IOnigLib>({
    createOnigScanner: (patterns) => new onig.OnigScanner(patterns),
    createOnigString: (str) => new onig.OnigString(str)
  });

  // create registry (grammars are provided by the host)
  registry = new vsctm.Registry({
    onigLib,
    loadGrammar: async (scopeName) => {
      const grammar = await codeview.codeViewGrammar(scopeName);
      return grammar ? vsctm.parseRawGrammar(grammar.content, grammar.path) : null;
    }
  });

  // register languages
  languages = await codeview.codeViewLanguages();
  const registered = new Set(monaco.languages.getLanguages().map(lang => lang.id));
  for (const language of languages) {
    if (!language.scopeName || registered.has(language.id)) {
      continue;
    }
    registered.add(language.id);
    monaco.languages.register({
      id: language.id,
      aliases: language.aliases,
      extensions: language.extensions
    });
    const scopeName = language.scopeName;
    monaco.languages.registerTokensProviderFactory(language.id, {
      create: async () => {
        const grammar = await registry!.loadGrammar(scopeName);
        return grammar ? tokensProvider(grammar) : null;
      }
    });
    if (language.configuration) {
      monaco.languages.setLanguageConfiguration(
        language.id,
        languageConfiguration(language.configuration as LanguageConfigurationJson)
      );
    }
  }
}

// in lib mode vite inlines the wasm as a data url, otherwise it's a real url
async function loadOnigWasm(): Promise<ArrayBuffer> {
  const marker = ";base64,";
  const idx = onigWasmUrl.indexOf(marker);
  if (onigWasmUrl.startsWith("data:") && idx !== -1) {
    const binary = atob(onigWasmUrl.slice(idx + marker.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } else {
    const response = await fetch(onigWasmUrl);
    return response.arrayBuffer();
  }
}

// monaco encoded tokens provider backed by a textmate grammar (the binary
// token format produced by tokenizeLine2 is the one monaco consumes)
class TokenizerState implements monaco.languages.IState {
  constructor(public readonly ruleStack: vsctm.StateStack) { }
  clone() {
    return new TokenizerState(this.ruleStack);
  }
  equals(other: monaco.languages.IState) {
    return other instanceof TokenizerState && other.ruleStack === this.ruleStack;
  }
}

function tokensProvider(grammar: vsctm.IGrammar): monaco.languages.EncodedTokensProvider {
  return {
    getInitialState: () => new TokenizerState(vsctm.INITIAL),
    tokenizeEncoded: (line, state) => {
      const result = grammar.tokenizeLine2(line, (state as TokenizerState).ruleStack);
      return {
        tokens: result.tokens,
        endState: new TokenizerState(result.ruleStack)
      };
    }
  };
}

function themeBase(type: CodeViewColorTheme["type"]): monaco.editor.BuiltinTheme {
  switch (type) {
    case "light":
      return "vs";
    case "hcDark":
      return "hc-black";
    case "hcLight":
      return "hc-light";
    case "dark":
    default:
      return "vs-dark";
  }
}

// monaco's token color map only accepts #RRGGBB or #RRGGBBAA
function normalizeHex(color?: string): string | undefined {
  if (!color) {
    return undefined;
  }
  const match = color.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) {
    return undefined;
  }
  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    return "#" + hex.split("").map(c => c + c).join("");
  }
  return "#" + hex;
}

// monaco only accepts hex colors
function validColors(colors: Record<string, string>) {
  const valid: Record<string, string> = {};
  for (const [id, color] of Object.entries(colors)) {
    if (typeof color === "string" && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
      valid[id] = color;
    }
  }
  return valid;
}

// convert a vscode language-configuration.json into a monaco LanguageConfiguration

type RegExpJson = string | { pattern: string; flags?: string };

interface LanguageConfigurationJson {
  comments?: { lineComment?: string; blockComment?: [string, string] };
  brackets?: Array<[string, string]>;
  autoClosingPairs?: Array<[string, string] | { open: string; close: string; notIn?: string[] }>;
  surroundingPairs?: Array<[string, string] | { open: string; close: string }>;
  wordPattern?: RegExpJson;
  indentationRules?: {
    increaseIndentPattern?: RegExpJson;
    decreaseIndentPattern?: RegExpJson;
    indentNextLinePattern?: RegExpJson;
    unIndentedLinePattern?: RegExpJson;
  };
  folding?: {
    offSide?: boolean;
    markers?: { start?: RegExpJson; end?: RegExpJson };
  };
  onEnterRules?: Array<{
    beforeText?: RegExpJson;
    afterText?: RegExpJson;
    previousLineText?: RegExpJson;
    action?: { indent?: string; appendText?: string; removeText?: number };
  }>;
}

function languageConfiguration(json: LanguageConfigurationJson): monaco.languages.LanguageConfiguration {
  const config: monaco.languages.LanguageConfiguration = {};

  if (json.comments) {
    config.comments = json.comments;
  }
  if (json.brackets) {
    config.brackets = json.brackets;
  }
  if (json.autoClosingPairs) {
    config.autoClosingPairs = json.autoClosingPairs.map(pair =>
      Array.isArray(pair) ? { open: pair[0], close: pair[1] } : pair
    );
  }
  if (json.surroundingPairs) {
    config.surroundingPairs = json.surroundingPairs.map(pair =>
      Array.isArray(pair) ? { open: pair[0], close: pair[1] } : pair
    );
  }
  const wordPattern = toRegExp(json.wordPattern);
  if (wordPattern) {
    config.wordPattern = wordPattern;
  }
  if (json.indentationRules) {
    const increase = toRegExp(json.indentationRules.increaseIndentPattern);
    const decrease = toRegExp(json.indentationRules.decreaseIndentPattern);
    if (increase && decrease) {
      config.indentationRules = {
        increaseIndentPattern: increase,
        decreaseIndentPattern: decrease,
        indentNextLinePattern: toRegExp(json.indentationRules.indentNextLinePattern),
        unIndentedLinePattern: toRegExp(json.indentationRules.unIndentedLinePattern)
      };
    }
  }
  if (json.folding) {
    const start = toRegExp(json.folding.markers?.start);
    const end = toRegExp(json.folding.markers?.end);
    config.folding = {
      offSide: json.folding.offSide,
      markers: start && end ? { start, end } : undefined
    };
  }
  if (json.onEnterRules) {
    const rules: monaco.languages.OnEnterRule[] = [];
    for (const rule of json.onEnterRules) {
      const beforeText = toRegExp(rule.beforeText);
      if (!beforeText || !rule.action) {
        continue;
      }
      rules.push({
        beforeText,
        afterText: toRegExp(rule.afterText),
        previousLineText: toRegExp(rule.previousLineText),
        action: {
          indentAction: indentAction(rule.action.indent),
          appendText: rule.action.appendText,
          removeText: rule.action.removeText
        }
      });
    }
    config.onEnterRules = rules;
  }

  return config;
}

function toRegExp(value?: RegExpJson): RegExp | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return typeof value === "string"
      ? new RegExp(value)
      : new RegExp(value.pattern, value.flags);
  } catch {
    return undefined;
  }
}

function indentAction(indent?: string): monaco.languages.IndentAction {
  switch (indent) {
    case "indent":
      return monaco.languages.IndentAction.Indent;
    case "outdent":
      return monaco.languages.IndentAction.Outdent;
    case "indentOutdent":
      return monaco.languages.IndentAction.IndentOutdent;
    case "none":
    default:
      return monaco.languages.IndentAction.None;
  }
}
