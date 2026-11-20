/*
 * executors.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

// TODO: implement some terminal based executors
// (e.g. see https://github.com/JeepShen/vscode-markdown-code-runner)


import { TextDocument, Range } from "vscode";

import {
  codeForExecutableLanguageBlock,
  isExecutableLanguageBlock,
  languageNameFromBlock,
  Token,
  TokenCodeBlock,
  TokenMath
} from "quarto-core";

import { lines } from "core";

import { cellOptionsForToken, kExecuteEval, leadingOptionYaml } from "./options";

import { CellExecutor, ExtensionHost } from "../../host";
import { MarkdownEngine } from "../../markdown/engine";
import { isInlineOutputEnabled } from "../../host/positron";
import { Position } from "vscode";
import { Uri } from "vscode";


/**
 * The cell languages that can be run in one document: the host's
 * `executableLanguages`, plus the ones it says it runs there (see
 * {@link documentExecutableLanguages}).
 */
export type ExecutableLanguages = ReadonlySet<string>;

/**
 * The languages that can be run in `document`, whose parsed `tokens` are
 * passed: the host's `executableLanguages` (in the visual editor, when
 * `visualMode`), plus the ones it says it runs in this document. The host is
 * asked, in one question, about the document's other cell languages, so this
 * is async; the result feeds the synchronous filters below.
 */
export async function documentExecutableLanguages(
  host: ExtensionHost,
  document: TextDocument,
  engine: MarkdownEngine,
  tokens: Token[],
  visualMode = false
): Promise<ExecutableLanguages> {
  const languages = new Set(host.executableLanguages(visualMode, document, engine));
  if (host.hostExecutableLanguages) {
    const cellLanguages = new Set<string>();
    for (const token of tokens) {
      if (isExecutableLanguageBlock(token)) {
        const language = languageNameFromBlock(token);
        if (!languages.has(language)) {
          cellLanguages.add(language);
        }
      }
    }
    if (cellLanguages.size > 0) {
      for (const language of await host.hostExecutableLanguages(document, [...cellLanguages])) {
        languages.add(language);
      }
    }
  }
  return languages;
}

export function hasExecutor(languages: ExecutableLanguages, language: string) {
  return languages.has(language);
}

export function blockHasExecutor(languages: ExecutableLanguages, token?: Token): token is TokenMath | TokenCodeBlock {
  if (token) {
    const language = languageNameFromBlock(token);
    return isExecutableLanguageBlock(token) && hasExecutor(languages, language);
  } else {
    return false;
  }
}

export function blockIsExecutable(languages: ExecutableLanguages, token?: Token): token is TokenMath | TokenCodeBlock {
  if (token) {
    return (
      blockHasExecutor(languages, token) && cellOptionsForToken(token)[kExecuteEval] !== false
    );
  } else {
    return false;
  }
}

// extract cell options as execution metadata (returns undefined if no options)
export function cellMetadataForBlock(token: TokenMath | TokenCodeBlock): Record<string, unknown> | undefined {
  const options = cellOptionsForToken(token);
  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * `code` without its leading cell option lines, which are written with the
 * language's own comment characters (`#|` for python, `--|` for sql, ...).
 * Runtimes need not see them, and some read the cell's leading comments
 * themselves.
 */
export function codeWithoutOptions(language: string, code: string): string {
  const codeLines = lines(code);
  const optionLineCount = leadingOptionYaml(language, codeLines).length;
  return optionLineCount === 0 ? code : codeLines.slice(optionLineCount).join("\n");
}

// skip yaml options for execution
export function codeWithoutOptionsFromBlock(token: TokenMath | TokenCodeBlock) {
  if (isExecutableLanguageBlock(token)) {
    return codeWithoutOptions(languageNameFromBlock(token), codeForExecutableLanguageBlock(token));
  } else {
    return "";
  }
}

export async function executeInteractive(
  executor: CellExecutor,
  blocks: string[],
  document: TextDocument,
  ranges?: Range[],
  metadata?: Record<string, unknown>[]
): Promise<void> {
  // If inline output is enabled, the document has a URI, and the executor supports
  // inline execution, use that instead of the standard console execution
  if (isInlineOutputEnabled() &&
    !document.isUntitled &&
    ranges &&
    ranges.length > 0 &&
    executor.executeInlineCells) {
    return await executor.executeInlineCells(document.uri, ranges, metadata);
  }
  return await executor.execute(blocks, !document.isUntitled ? document.uri : undefined, metadata);
}


export async function executeAtPositionInteractive(executor: CellExecutor, uri: Uri, position: Position) {
  if (executor?.executeAtPosition) {
    return await executor.executeAtPosition(uri, position);
  }
}
// attempt language aware execution of current selection (returns false
// if the executor doesn't support this, in which case generic
// executeInteractive will be called)
export async function executeSelectionInteractive(executor: CellExecutor) {
  if (executor?.executeSelection) {
    await executor.executeSelection();
    return true;
  } else {
    return false;
  }
}

