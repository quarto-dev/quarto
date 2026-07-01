/*
 * options.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 */

import * as jsYaml from "js-yaml";

export const kCellId = "id";
export const kCellLabel = "label";

export function partitionCellOptions(
  language: string,
  source: string[],
) {
  const commentChars = langCommentChars(language);
  const optionPattern = optionCommentPattern(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

  // find the yaml lines
  const optionsSource: string[] = [];
  const yamlLines: string[] = [];
  for (const line of source) {
    const optionMatch = line.match(optionPattern);
    if (optionMatch) {
      if (!optionSuffix || line.trimEnd().endsWith(optionSuffix)) {
        let yamlOption = line.substring(optionMatch[0].length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimEnd();
          yamlOption = yamlOption.substring(
            0,
            yamlOption.length - optionSuffix.length,
          );
          if (line.endsWith("\r\n")) {
            yamlOption += "\r\n";
          } else if (line.endsWith("\r") || line.endsWith("\n")) {
            yamlOption += line[line.length - 1];
          }
        }
        yamlLines.push(yamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }

  const yaml = yamlLines.length > 0 ? jsYaml.load(yamlLines.join("\n")) : undefined;
  return {
    yaml: yaml as Record<string, unknown> | undefined,
    optionsSource,
    source: source.slice(yamlLines.length),
    sourceStartLine: yamlLines.length,
  };
}

function optionCommentPattern(comment: string) {
  return new RegExp("^" + escapeRegExp(comment) + "\\s*\\| ?");
}

function langCommentChars(lang: string): string[] {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
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
  prql: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  scss: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//",
  apl: "⍝",
};

