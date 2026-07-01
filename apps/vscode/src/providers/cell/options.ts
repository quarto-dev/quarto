/*
 * options.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import * as yaml from "js-yaml";

import { lines } from "core";
import { Token, isCodeBlock, languageNameFromBlock } from "quarto-core";


export const kExecuteEval = "eval";

export function cellOptionsForToken(token: Token): Record<string, unknown> {
  if (isCodeBlock(token)) {
    const language = languageNameFromBlock(token);
    const source = lines(token.data);
    return cellOptions(language, source);
  } else {
    return {};
  }
}

export function cellOptions(language: string, source: string[]): Record<string, unknown> {

  const commentChars = langCommentChars(language);
  const optionPattern = optionCommentPattern(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: string[] = [];
  const yamlLines: string[] = [];
  for (const line of source) {
    const optionMatch = line.match(optionPattern);
    if (optionMatch) {
      if (!optionSuffix || line.trimRight().endsWith(optionSuffix)) {
        let yamlOption = line.substring(optionMatch[0].length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimRight();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length
          );
        }
        yamlLines.push(yamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  // parse the yaml
  if (yamlLines.length > 0) {
    try {
      const options = yaml.load(yamlLines.join("\n"));
      if (
        typeof options === "object" &&
        !Array.isArray(options) &&
        options !== null
      ) {
        return options as Record<string, unknown>;
      } else {
        return {};
      }
    } catch (_e) {
      // ignore for invalid yaml
      return {};
    }
  } else {
    return {};
  }
}

function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
export function optionCommentPattern(comment: string) {
  return new RegExp("^" + escapeRegExp(comment) + "\\s*\\| ?");
}

const kLangCommentChars: Record<string, string | [string, string]> = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//",
  apl: "⍝",
};

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
