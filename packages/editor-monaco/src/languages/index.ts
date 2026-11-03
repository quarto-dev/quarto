/*
 * index.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * Map quarto code block languages to the language ids registered with
 * monaco (which are the ids of the languages the host contributes).
 */

import { contributedLanguages } from "../textmate";

export const kPlainTextLanguage = "plaintext";

// quarto / pandoc language names that differ from the vscode language id
const kLanguageAliases: Record<string, string> = {
  "yaml-frontmatter": "yaml",
  yml: "yaml",
  ojs: "javascript",
  js: "javascript",
  ts: "typescript",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  py: "python",
  jl: "julia",
  "c++": "cpp",
  md: "markdown",
  tex: "latex",
  rs: "rust",
  rb: "ruby",
  ps1: "powershell",
  pwsh: "powershell"
};

/**
 * Resolve a quarto code block language to a monaco language id (plaintext
 * if the host doesn't have a grammar for the language)
 */
export function monacoLanguageId(lang: string): string {
  const candidate = (kLanguageAliases[lang] ?? lang).toLowerCase();
  if (!candidate) {
    return kPlainTextLanguage;
  }

  const languages = contributedLanguages().filter(language => !!language.scopeName);

  const byId = languages.find(language => language.id.toLowerCase() === candidate);
  if (byId) {
    return byId.id;
  }

  const byAlias = languages.find(language =>
    language.aliases.some(alias => alias.toLowerCase() === candidate)
  );
  if (byAlias) {
    return byAlias.id;
  }

  const byExtension = languages.find(language =>
    language.extensions.some(ext => ext.toLowerCase() === `.${candidate}`)
  );
  if (byExtension) {
    return byExtension.id;
  }

  return kPlainTextLanguage;
}
