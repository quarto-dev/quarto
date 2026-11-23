/*
 * options.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */



import { lines, loadYaml } from "core";
import { Token, isCodeBlock, languageNameFromBlock } from "quarto-core";

import { langCommentChars, optionCommentPattern } from "./comment-chars";

export { optionCommentPattern } from "./comment-chars";


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

  // find the yaml lines
  const yamlLines = leadingOptionYaml(language, source);

  // parse the yaml
  if (yamlLines.length > 0) {
    try {
      const options = loadYaml(yamlLines.join("\n"));
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

/**
 * The YAML of the option lines at the start of a cell's source, with their
 * comment characters removed (e.g. `#| echo: false` gives `echo: false`, and
 * `*| echo: false;` for sas gives the same). The number of entries is the
 * number of option lines.
 */
export function leadingOptionYaml(language: string, source: string[]): string[] {
  const commentChars = langCommentChars(language);
  const optionPattern = optionCommentPattern(commentChars[0]);
  const optionSuffix = commentChars[1] || "";

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
        continue;
      }
    }
    break;
  }
  return yamlLines;
}
