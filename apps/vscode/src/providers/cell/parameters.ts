/*
 * parameters.ts
 *
 * Runs a Jupyter document's parameters cell before other cells that are run
 * interactively.
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
 * The executor for `language` cells in `document`, which first runs the
 * document's parameters cell when that has not run yet (see `parametersCell`).
 */
export async function cellExecutorWithParameters(
  host: ExtensionHost,
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): Promise<CellExecutor | undefined> {
  const executor = await host.cellExecutorForLanguage(language, document, engine);
  if (executor !== undefined) {
    return withParameters(executor, host, language, document, engine);
  }
}

/** A document's parameters cell, as it is run. */
interface ParametersCode {
  code: string;
  range: Range;
  metadata: Record<string, unknown>;
}

function withParameters(
  executor: CellExecutor,
  host: ExtensionHost,
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): CellExecutor {
  const runtimeOf = (lang: string) => host.cellRuntimeLanguage?.(lang, document, engine) ?? lang;

  const parametersCellIfValid = () => {
    if (!isAutoLoadParametersOn(document) || isKnitrDocument(document, engine)) {
      return undefined;
    }
    const cell = parametersCell(engine.parse(document));
    if (
      cell === undefined ||
      cellOptionsForToken(cell)[kExecuteEval] === false ||
      runtimeOf(languageNameFromBlock(cell)) !== runtimeOf(language)
    ) {
      return undefined;
    }
    return cell;
  };
  // the parameters cell of this document, when it shares a runtime with
  // `language` cells and is one that is run
  const findParameters = (): ParametersCode | undefined => {
    const cell = parametersCellIfValid();
    if (cell === undefined) return undefined;

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

  // identifies the session that `language` cells of this document run in
  const sessionKey = async (inline: boolean) => {
    const session = await host.cellSessionKey?.(runtimeOf(language), document, inline);
    return [
      runtimeOf(language),
      inline ? "inline" : "console",
      session ?? ""
    ].join("\n");
  };

  // whether the parameters have run, as they are now, in the session that
  // `language` cells run in (with inline output when `inline`)
  const haveParamsBeenAutoLoaded = async (parameters: ParametersCode, inline: boolean) => {
    const loaded = loadedParameters.get(document.uri.toString());
    return loaded?.code === parameters.code && loaded.sessionKey === await sessionKey(inline);
  };

  const markParamsAsLoaded = async (parameters: ParametersCode, { inline }: { inline: boolean; }) => {
    loadedParameters.set(document.uri.toString(), {
      sessionKey: await sessionKey(inline),
      code: parameters.code
    });
  };

  // run the parameters cell in the console, unless it has already run there
  const autoLoadParams = async (parameters: ParametersCode) => {
    if (await haveParamsBeenAutoLoaded(parameters, false)) {
      return;
    }
    // marked before running, so that a run started meanwhile doesn't load
    // them too, and again after, as running can be what starts the session
    // (in Positron, when no console is open yet)
    await markParamsAsLoaded(parameters, { inline: false });
    await executor.execute([parameters.code], document.isUntitled ? undefined : document.uri, [parameters.metadata]);
    await markParamsAsLoaded(parameters, { inline: false });
  };

  // whether the editor's selection is within the parameters cell, in which
  // case the user is running that cell by hand, a piece at a time
  const isSelectionInParameters = (parameters: ParametersCode) => {
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
        await markParamsAsLoaded(parameters, { inline: false });
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
      await markParamsAsLoaded(parameters, { inline: false });
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
      if (!runsParameters && !(await haveParamsBeenAutoLoaded(parameters, true))) {
        // the parameters cell runs inline too, ahead of the requested cells
        executionMetadata = [parameters.metadata, ...(executionMetadata ?? cellRanges.map(() => ({})))];
        cellRanges = [parameters.range, ...cellRanges];
      }
      await executeInlineCells(documentUri, cellRanges, executionMetadata);
      await markParamsAsLoaded(parameters, { inline: true });
    };
  }

  return wrapped;
}
