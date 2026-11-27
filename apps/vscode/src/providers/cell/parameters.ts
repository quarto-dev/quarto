/*
 * parameters.ts
 *
 * Loads a document's parameters before cells that are run interactively: a
 * Jupyter document's parameters cell, or the `params` that a knitr document
 * declares in its front matter.
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Position, Range, TextDocument, Uri, window, workspace } from "vscode";

import {
  Token,
  TokenCodeBlock,
  isExecutableLanguageBlock,
  languageNameFromBlock
} from "quarto-core";

import { CellExecutor, ExtensionHost } from "../../host";
import { isKnitrDocument } from "../../host/executors";
import { documentFrontMatterYaml } from "../../markdown/document";
import { MarkdownEngine } from "../../markdown/engine";
import { cellMetadataForBlock, codeWithoutOptionsFromBlock } from "./executors";
import { cellOptionsForToken, kExecuteEval } from "./options";

const kParametersTag = "parameters";

/**
 * The cell that holds a Jupyter document's parameters: the first cell tagged
 * `parameters` (`#| tags: [parameters]`), as papermill and `quarto render -P`
 * read it.
 */
export function parametersCell(tokens: Token[]): TokenCodeBlock | undefined {
  return tokens.find((token): token is TokenCodeBlock => {
    if (!isExecutableLanguageBlock(token)) {
      return false;
    }
    const tags = cellOptionsForToken(token)["tags"];
    return Array.isArray(tags) ? tags.includes(kParametersTag) : tags === kParametersTag;
  });
}

/**
 * The lines of front matter that declare a knitr document's `params`: the
 * `params` key and all that is nested under it, as written, so that tags such
 * as `!expr` are kept for knitr to read.
 *
 * For example, for the front matter `title: Report\nparams:\n  alpha: 0.1\n
 * day: !expr Sys.Date()\nengine: knitr`:
 *
 * ```
 * ["params:", "  alpha: 0.1", "  day: !expr Sys.Date()"]
 * ```
 */
const isParamsKey = (line: string) => /^params\s*:/.test(line);
const isBlankOrComment = (line: string) => /^\s*(#.*)?$/.test(line);
const isIndented = (line: string) => /^\s/.test(line);
// top level keys start in the first column: what is nested under a key is
// indented
const isTopLevelKey = (line: string) => !isBlankOrComment(line) && !isIndented(line);
export function frontMatterParametersLines(frontMatterYaml: string): string[] | undefined {
  const lines = frontMatterYaml.split(/\r?\n/);
  const paramsIndex = lines.findIndex(isParamsKey);
  if (paramsIndex === -1) {
    return undefined;
  }
  const paramsLine = lines[paramsIndex];

  // the lines under `params:`, up to the next top level key
  const linesAfterParams = lines.slice(paramsIndex + 1);
  const nextKeyIndex = linesAfterParams.findIndex(isTopLevelKey);
  const nestedLines = nextKeyIndex === -1 ? linesAfterParams : linesAfterParams.slice(0, nextKeyIndex);

  // blank lines and comments at the end belong to what follows
  while (nestedLines.length > 0 && isBlankOrComment(nestedLines[nestedLines.length - 1])) {
    nestedLines.pop();
  }

  // a value written on the `params:` line itself, as in `params: {alpha: 0.1}`
  const valueOnParamsLine = paramsLine.replace(/^params\s*:/, "").replace(/#.*$/, "").trim();
  if (nestedLines.length === 0 && valueOnParamsLine.length === 0) {
    return undefined;
  }
  return [paramsLine, ...nestedLines];
}

/**
 * R code that defines `params` as rendering a knitr document does: knitr
 * reads the values out of the front matter (see `frontMatterParametersLines`),
 * evaluating any that are R expressions. Unlike at render, `params` is not
 * locked, so that it can be loaded again once the front matter is edited.
 * In a session without knitr, the code says to install it and leaves `params`
 * as it is.
 *
 * For example, for `["params:", "  alpha: 0.1"]`:
 *
 * ```r
 * if (requireNamespace("knitr", quietly = TRUE)) params <- lapply(knitr::knit_params(c("---", "params:", "  alpha: 0.1", "---")), function(param) param$value) else message("Install the knitr package to load this document's params.")
 * ```
 */
export function knitrParametersCode(parametersLines: string[]): string {
  // JSON string escapes are ones that R reads too
  const lines = ["---", ...parametersLines, "---"].map((line) => JSON.stringify(line)).join(", ");
  const loadParams = `params <- lapply(knitr::knit_params(c(${lines})), function(param) param$value)`;
  const explainNoKnitr = `message("Install the knitr package to load this document's params.")`;
  // on one line, which the console reads as a single statement
  return `if (requireNamespace("knitr", quietly = TRUE)) ${loadParams} else ${explainNoKnitr}\n`;
}

/**
 * For each document (by uri), the parameters code that was last run and the
 * session it ran in (see `sessionKey`). Only the latest session is kept: a
 * new one replaces it. The parameters cell is run again when its code changes
 * or the session is another one, which in Positron includes a restarted one.
 *
 * For example, after running cells of `report.qmd` in a Positron Python
 * console that has restarted once (the parts of a session key are joined by
 * newlines, and the last part is empty when the host cannot tell sessions
 * apart, as in VS Code):
 *
 * ```
 * Map {
 *   "file:///work/report.qmd" => {
 *     sessionKey: "python\nconsole\npython-1a2b3c#1",
 *     code: "alpha = 0.1\nratio = 2\n"
 *   }
 * }
 * ```
 */
const loadedParameters = new Map<string, { sessionKey: string; code: string; }>();

/** Forget which of a document's parameters have been run. */
export function forgetLoadedParameters(document: Uri) {
  loadedParameters.delete(document.toString());
}

/** Forget which parameters have been run, in every document. */
export function forgetAllLoadedParameters() {
  loadedParameters.clear();
}

function isAutoLoadParametersOn(document: TextDocument): boolean {
  return workspace.getConfiguration("quarto", document.uri).get("cells.autoLoadParameters", true);
}

/**
 * The executor for `language` cells in `document`, which first loads the
 * document's parameters when they are not loaded yet: the `params` in the
 * front matter of a knitr document (see `withKnitrParameters`), and otherwise
 * the parameters cell (see `withJupyterParametersCell`).
 */
export async function cellExecutorWithParameters(
  host: ExtensionHost,
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): Promise<CellExecutor | undefined> {
  const executor = await host.cellExecutorForLanguage(language, document, engine);
  if (executor === undefined || !isAutoLoadParametersOn(document)) {
    return executor;
  }
  if (isKnitrDocument(document, engine)) {
    // only R cells read `params` (and only their executor runs R code as is)
    return language === "r" ? withKnitrParametersYaml(executor, host, document, engine) : executor;
  }
  return withJupyterParametersCell(executor, host, language, document, engine);
}

/**
 * Keeps track of whether a document's parameters code has run in the session
 * that its `runtimeLanguage` cells run in (see `loadedParameters`).
 */
interface LoadedParametersTracker {
  /** Whether `code` is what last ran, in the session that cells run in now. */
  isLoaded(code: string, inline: boolean): Promise<boolean>;
  markLoaded(code: string, inline: boolean): Promise<void>;
}

function loadedParametersTracker(
  host: ExtensionHost,
  runtimeLanguage: string,
  document: TextDocument
): LoadedParametersTracker {
  // identifies the session that `runtimeLanguage` cells of this document run
  // in (the one for inline output when `inline`)
  const sessionKey = async (inline: boolean) => {
    const session = await host.cellSessionKey?.(runtimeLanguage, document, inline);
    return [
      runtimeLanguage,
      inline ? "inline" : "console",
      session ?? ""
    ].join("\n");
  };

  return {
    isLoaded: async (code, inline) => {
      const loaded = loadedParameters.get(document.uri.toString());
      return loaded?.code === code && loaded.sessionKey === await sessionKey(inline);
    },
    markLoaded: async (code, inline) => {
      loadedParameters.set(document.uri.toString(), { sessionKey: await sessionKey(inline), code });
    }
  };
}

/**
 * Wraps the executor for R cells of a knitr document, so that it first
 * defines `params` from the front matter (see `knitrParametersCode`) when that
 * has not been done yet, or the `params` there have changed since.
 *
 * Cells that run with inline output are run as they are: the code that
 * defines `params` is not in the document, and so cannot run inline.
 */
function withKnitrParametersYaml(
  executor: CellExecutor,
  host: ExtensionHost,
  document: TextDocument,
  engine: MarkdownEngine
): CellExecutor {
  const runtimeLanguage = host.cellRuntimeLanguage?.("r", document, engine) ?? "r";
  const tracker = loadedParametersTracker(host, runtimeLanguage, document);

  const loadParams = async () => {
    const lines = frontMatterParametersLines(documentFrontMatterYaml(engine, document));
    if (lines === undefined) {
      return;
    }
    const code = knitrParametersCode(lines);
    if (await tracker.isLoaded(code, false)) {
      return;
    }
    // marked before running, so that a run started meanwhile doesn't load
    // them too, and again after, as running can be what starts the session
    // (in Positron, when no console is open yet)
    await tracker.markLoaded(code, false);
    await executor.execute([code], document.isUntitled ? undefined : document.uri);
    await tracker.markLoaded(code, false);
  };

  const wrapped: CellExecutor = {
    ...executor,
    execute: async (blocks, editorUri, executionMetadata) => {
      await loadParams();
      return executor.execute(blocks, editorUri, executionMetadata);
    },
  };

  if (executor.executeSelection) {
    const executeSelection = executor.executeSelection;
    wrapped.executeSelection = async () => {
      await loadParams();
      return executeSelection();
    };
  }

  if (executor.executeAtPosition) {
    const executeAtPosition = executor.executeAtPosition;
    wrapped.executeAtPosition = async (uri, position) => {
      await loadParams();
      return executeAtPosition(uri, position);
    };
  }

  return wrapped;
}

/** A Jupyter document's parameters cell, as it is run. */
interface JupyterParametersCellCode {
  code: string;
  range: Range;
  metadata: Record<string, unknown>;
}

/**
 * Wraps the executor for `language` cells of a Jupyter document, so that it
 * first runs the document's parameters cell (see `parametersCell`) when that
 * has not run yet, or has changed since.
 */
function withJupyterParametersCell(
  executor: CellExecutor,
  host: ExtensionHost,
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): CellExecutor {
  const runtimeOf = (lang: string) => host.cellRuntimeLanguage?.(lang, document, engine) ?? lang;
  const tracker = loadedParametersTracker(host, runtimeOf(language), document);

  // the parameters cell of this document, when it shares a runtime with
  // `language` cells and is one that is run
  const findParameters = (): JupyterParametersCellCode | undefined => {
    const cell = parametersCell(engine.parse(document));
    if (
      cell === undefined ||
      cellOptionsForToken(cell)[kExecuteEval] === false ||
      runtimeOf(languageNameFromBlock(cell)) !== runtimeOf(language)
    ) {
      return undefined;
    }

    const code = codeWithoutOptionsFromBlock(cell);
    if (code.trim().length === 0) {
      return undefined;
    }
    const range = new Range(
      new Position(cell.range.start.line, cell.range.start.character),
      new Position(cell.range.end.line, cell.range.end.character)
    );
    return { code, range, metadata: cellMetadataForBlock(cell) ?? {} };
  };

  // run the parameters cell in the console, unless it has already run there
  const autoLoadParams = async (parameters: JupyterParametersCellCode) => {
    if (await tracker.isLoaded(parameters.code, false)) {
      return;
    }
    // marked before running, so that a run started meanwhile doesn't load
    // them too, and again after, as running can be what starts the session
    // (in Positron, when no console is open yet)
    await tracker.markLoaded(parameters.code, false);
    await executor.execute([parameters.code], document.isUntitled ? undefined : document.uri, [parameters.metadata]);
    await tracker.markLoaded(parameters.code, false);
  };

  // whether the editor's selection is within the parameters cell, in which
  // case the user is running that cell by hand, a piece at a time
  const isSelectionInParameters = (parameters: JupyterParametersCellCode) => {
    const editor = window.activeTextEditor;
    return editor?.document.uri.toString() === document.uri.toString() &&
      parameters.range.contains(editor.selection);
  };

  const wrapped: CellExecutor = {
    ...executor,
    execute: async (blocks, editorUri, executionMetadata) => {
      const parameters = findParameters();
      if (parameters === undefined) {
        // execute normally
        return executor.execute(blocks, editorUri, executionMetadata);
      }
      const doesExecutionIncludeParameters = blocks.includes(parameters.code);
      if (doesExecutionIncludeParameters) {
        // execute normally then mark params as loaded
        await executor.execute(blocks, editorUri, executionMetadata);
        await tracker.markLoaded(parameters.code, false);
        return;
      }
      // a selection of the parameters cell, which the user is running manually
      const isExecutingSelectionOfParameters = blocks.length === 1 &&
        blocks[0].trim().length > 0 &&
        parameters.code.includes(blocks[0].trim());
      if (isExecutingSelectionOfParameters) {
        // execute normally
        return executor.execute(blocks, editorUri, executionMetadata);
      }

      // execute params code, then execute normally, then mark params as loaded
      await autoLoadParams(parameters);
      await executor.execute(blocks, editorUri, executionMetadata);
      await tracker.markLoaded(parameters.code, false);
    },
  };

  if (executor.executeSelection) {
    const executeSelection = executor.executeSelection;
    wrapped.executeSelection = async () => {
      const parameters = findParameters();
      if (parameters !== undefined && !isSelectionInParameters(parameters)) {
        await autoLoadParams(parameters);
      }
      return executeSelection();
    };
  }

  if (executor.executeAtPosition) {
    const executeAtPosition = executor.executeAtPosition;
    wrapped.executeAtPosition = async (uri, position) => {
      const parameters = findParameters();
      if (parameters !== undefined && !isSelectionInParameters(parameters)) {
        await autoLoadParams(parameters);
      }
      return executeAtPosition(uri, position);
    };
  }

  if (executor.executeInlineCells) {
    const executeInlineCells = executor.executeInlineCells;
    wrapped.executeInlineCells = async (documentUri, cellRanges, executionMetadata) => {
      const parameters = findParameters();
      if (parameters === undefined) {
        return executeInlineCells(documentUri, cellRanges, executionMetadata);
      }
      const runsParameters = cellRanges.some((range) => range.intersection(parameters.range) !== undefined);
      if (!runsParameters && !(await tracker.isLoaded(parameters.code, true))) {
        // the parameters cell runs inline too, ahead of the requested cells
        executionMetadata = [parameters.metadata, ...(executionMetadata ?? cellRanges.map(() => ({})))];
        cellRanges = [parameters.range, ...cellRanges];
      }
      await executeInlineCells(documentUri, cellRanges, executionMetadata);
      await tracker.markLoaded(parameters.code, true);
    };
  }

  return wrapped;
}
