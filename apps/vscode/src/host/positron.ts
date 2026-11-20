/*
 * positron.ts
 *
 * Positron-specific functionality.
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import * as vscode from 'vscode';
import * as positron from 'positron';

import { ExtensionHost, HostWebviewPanel, HostStatementRangeProvider, HostHelpTopicProvider } from '.';
import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument, pythonWithReticulate } from './executors';
import { ExecuteQueue } from './execute-queue';
import { MarkdownEngine } from '../markdown/engine';
import { virtualDoc, adjustedPosition, unadjustedRange, withVirtualDocUri, VirtualDocStyle, unadjustedLine } from "../vdoc/vdoc";
import { Position, Range } from 'vscode';
import { Uri } from 'vscode';
import { tryAcquirePositronApi } from '@posit-dev/positron';
import { kHostExplainUnrunnableCellCommand } from './cell-features';

/**
 * The canonical Positron setting for enabling Quarto inline output.
 */
export const kInlineOutputEnabledSetting = "quarto.inlineOutput.enabled";

/**
 * The deprecated alias for {@link kInlineOutputEnabledSetting}. Positron keeps
 * this key working during the deprecation window; reads prefer the new key and
 * fall back to this one.
 */
export const kInlineOutputEnabledSettingDeprecated =
  "positron.quarto.inlineOutput.enabled";

/**
 * Check if inline output is enabled in Positron settings.
 * This helper is shared with main.ts for code lens visibility.
 *
 * Prefers the canonical `quarto.inlineOutput.enabled` key and falls back to the
 * deprecated `positron.quarto.inlineOutput.enabled` alias when the new key has
 * not been explicitly set. Uses `inspect` so an explicit `false` on either key
 * is honored over the default.
 */
export function isInlineOutputEnabled(): boolean {
  const config = vscode.workspace.getConfiguration();

  const inspection = config.inspect<boolean>(kInlineOutputEnabledSetting);
  if (isConfigurationSet(inspection)) {
    return config.get<boolean>(kInlineOutputEnabledSetting, false);
  }

  const deprecatedInspection = config.inspect<boolean>(
    kInlineOutputEnabledSettingDeprecated
  );
  if (isConfigurationSet(deprecatedInspection)) {
    return config.get<boolean>(kInlineOutputEnabledSettingDeprecated, false);
  }

  return false;
}

/**
 * Whether a configuration value has been explicitly set at any level (as
 * opposed to falling back to its registered default).
 */
function isConfigurationSet<T>(
  inspection: { globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T; } | undefined
): boolean {
  return (
    inspection?.globalValue !== undefined ||
    inspection?.workspaceValue !== undefined ||
    inspection?.workspaceFolderValue !== undefined
  );
}

/**
 * The languages that extensions declare runtimes for in the `languageRuntimes`
 * contribution of their `package.json`, e.g. `sas` from the SAS extension or
 * `ggsql` from the ggsql extension.
 */
export function contributedRuntimeLanguages(
  extensions: readonly { packageJSON: unknown }[]
): Set<string> {
  const languages = new Set<string>();
  for (const extension of extensions) {
    const packageJSON = extension.packageJSON as
      { contributes?: { languageRuntimes?: unknown } } | undefined;
    const contributions = packageJSON?.contributes?.languageRuntimes;
    if (!Array.isArray(contributions)) {
      continue;
    }
    for (const contribution of contributions) {
      const languageId = (contribution as { languageId?: unknown } | undefined)?.languageId;
      if (typeof languageId === "string" && languageId.length > 0) {
        languages.add(languageId);
      }
    }
  }
  return languages;
}

/**
 * Languages whose cells can run in a Positron console of the same language.
 * They come from two sources, as in Positron's own check for inline output
 * (`hasLanguageRuntimeProvider`):
 *
 * - the `languageRuntimes` contributions of the installed extensions, which
 *   are known before those extensions activate or discover any runtime, and
 * - the registered runtimes, for an extension that registers a runtime
 *   without declaring the contribution.
 *
 * Both are cached because the checks for whether a cell can run are
 * synchronous. They are tracked only in Positron, so nothing changes in
 * VS Code even when such extensions are installed. Positron can also run
 * cells of other languages in another language's runtime (e.g. `{sql}` cells
 * in ggsql); see {@link positronRuntimeLanguage}.
 *
 * See also https://github.com/posit-dev/positron/issues/17432
 */
let contributedLanguages = new Set<string>();
const registeredLanguages = new Set<string>();

const runtimeLanguagesEmitter = new vscode.EventEmitter<void>();

/**
 * Fires when a language gains or loses a Positron runtime, so that providers
 * such as the cell code lenses can refresh.
 */
export const onDidChangeRuntimeLanguages = runtimeLanguagesEmitter.event;

/**
 * Track the languages with a Positron runtime. Returns a no-op outside
 * Positron. The caller disposes the result on deactivation.
 */
export function trackRuntimeLanguages(outputChannel?: vscode.LogOutputChannel): vscode.Disposable {
  const runtime = tryAcquirePositronApi()?.runtime;
  if (runtime === undefined) {
    return new vscode.Disposable(() => { });
  }
  return trackRuntimeLanguagesWith(runtime, vscode.extensions, outputChannel);
}

/**
 * {@link trackRuntimeLanguages} with the runtime and extensions APIs passed
 * in, for tests.
 */
export function trackRuntimeLanguagesWith(
  runtime: Pick<typeof positron.runtime, "getRegisteredRuntimes" | "onDidRegisterRuntime">,
  extensions: Pick<typeof vscode.extensions, "all" | "onDidChange">,
  outputChannel?: vscode.LogOutputChannel
): vscode.Disposable {
  let disposed = false;
  registeredLanguages.clear();

  const register = (languageId: string) => {
    if (disposed) {
      return;
    }
    const isNew = !hasPositronRuntime(languageId);
    registeredLanguages.add(languageId);
    if (isNew) {
      runtimeLanguagesEmitter.fire();
    }
  };

  // the contributions are read synchronously, so they are known right away
  contributedLanguages = contributedRuntimeLanguages(extensions.all);
  const extensionsListener = extensions.onDidChange(() => {
    const before = positronRuntimeLanguages();
    contributedLanguages = contributedRuntimeLanguages(extensions.all);
    if (!sameLanguages(before, positronRuntimeLanguages())) {
      runtimeLanguagesEmitter.fire();
    }
  });

  runtime.getRegisteredRuntimes().then(
    (runtimes) => runtimes.forEach((metadata) => register(metadata.languageId)),
    (error) => outputChannel?.error(`Failed to get registered runtimes: ${error}`)
  );
  const runtimeListener = runtime.onDidRegisterRuntime((metadata) => register(metadata.languageId));

  return new vscode.Disposable(() => {
    disposed = true;
    extensionsListener.dispose();
    runtimeListener.dispose();
    contributedLanguages = new Set<string>();
    registeredLanguages.clear();
  });
}

function sameLanguages(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return a.length === b.length && b.every((language) => set.has(language));
}

/**
 * Whether Positron has a runtime for the language, so its cells can run in
 * the console.
 */
export function hasPositronRuntime(language: string): boolean {
  return contributedLanguages.has(language) || registeredLanguages.has(language);
}

function positronRuntimeLanguages(): string[] {
  return [...new Set([...contributedLanguages, ...registeredLanguages])];
}

/**
 * Cell languages this host hands to a Positron runtime of the same language,
 * whether or not an extension provides one (see `cellExecutorForLanguage`).
 */
const kPositronRuntimeLanguages: ReadonlySet<string> = new Set(["julia", "python", "csharp", "r"]);

/** The language ggsql registers its runtime under. */
const kGgsqlLanguage = "ggsql";

/**
 * The language of the Positron runtime that runs `language` cells, or
 * undefined when Positron runs none: the cell's own language when Positron
 * runs it (see {@link kPositronRuntimeLanguages} and
 * {@link hasPositronRuntime}), and ggsql for `{sql}` cells.
 *
 * A `{sql}` cell runs in ggsql, as Positron does with inline output: ggsql is
 * SQL with a visualization clause, and the SQL runtime there is. Not in a
 * document rendered with knitr (`knitr`), which renders `{sql}` cells with DBI
 * against the R connection the chunk names; running them in ggsql would query
 * another database than the one the document renders from. There, and without
 * ggsql, a `{sql}` cell runs only in a runtime of its own language, if any.
 */
export function positronRuntimeLanguage(
  language: string,
  knitr: boolean,
  hasRuntime: (language: string) => boolean = hasPositronRuntime
): string | undefined {
  if (language === "sql" && !knitr && hasRuntime(kGgsqlLanguage)) {
    return kGgsqlLanguage;
  }
  if (kPositronRuntimeLanguages.has(language) || hasRuntime(language)) {
    return language;
  }
  return undefined;
}

/**
 * Have Positron explain why a `language` cell in `document` cannot be run,
 * through {@link kHostExplainUnrunnableCellCommand}. Answers whether it
 * explained: `false` when Positron lacks the command, had nothing to say, or
 * the command failed.
 *
 * Probed for each time rather than once at activation, because Positron can
 * register it later; this runs only when the user runs a cell that cannot run.
 */
export async function hostExplainUnrunnableCell(
  language: string,
  document: vscode.TextDocument,
  outputChannel?: vscode.LogOutputChannel
): Promise<boolean> {
  // `false` keeps the underscore-prefixed id we are looking for
  const all = await vscode.commands.getCommands(false);
  if (!all.includes(kHostExplainUnrunnableCellCommand)) {
    return false;
  }
  try {
    const explained = await vscode.commands.executeCommand<unknown>(
      kHostExplainUnrunnableCellCommand,
      document.uri,
      language
    );
    outputChannel?.debug(
      `[CellFeatures] The host ${explained === true ? "explained" : "had nothing to say about"} ` +
      `the unrunnable ${language} cell.`
    );
    return explained === true;
  } catch (err) {
    outputChannel?.warn(`${kHostExplainUnrunnableCellCommand} failed for ${language}: ${err}`);
    return false;
  }
}

export function positronExtensionHost(outputChannel?: vscode.LogOutputChannel): ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages), plus any language with a
    // Positron runtime, and sql when ggsql runs it in this document
    executableLanguages: (_visualMode: boolean, document: vscode.TextDocument, engine: MarkdownEngine) => {
      const languages = new Set([...executableLanguages(), ...positronRuntimeLanguages()]);
      if (positronRuntimeLanguage("sql", isKnitrDocument(document, engine))) {
        languages.add("sql");
      }
      return [...languages];
    },

    // the runtime that runs a cell language, so that e.g. {sql} and {ggsql}
    // cells run together
    cellRuntimeLanguage: (language: string, document: vscode.TextDocument, engine: MarkdownEngine) =>
      positronRuntimeLanguage(language, isKnitrDocument(document, engine)),

    // let Positron say why a cell cannot be run (e.g. that it runs at render)
    explainNoExecutor: (language: string, document: vscode.TextDocument): Promise<boolean> =>
      hostExplainUnrunnableCell(language, document, outputChannel),

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean)
      : Promise<CellExecutor | undefined> => {
      // use positron api for known runtimes, any other language with a
      // Positron runtime (e.g. SAS or ggsql from an extension), and sql in
      // ggsql; delegate the rest
      const runtimeLanguage = positronRuntimeLanguage(language, isKnitrDocument(document, engine));
      if (runtimeLanguage !== undefined) {
        return positronCellExecutor(language, runtimeLanguage, document, engine, outputChannel);
      }
      return cellExecutorForLanguage(language, document, engine, silent);
    },

    registerStatementRangeProvider: (engine: MarkdownEngine): vscode.Disposable => {
      const positronApi = tryAcquirePositronApi();
      if (positronApi) {
        return positronApi.languages.registerStatementRangeProvider('quarto',
          new EmbeddedStatementRangeProvider(engine));
      }
      return new vscode.Disposable(() => { });
    },

    registerHelpTopicProvider: (engine: MarkdownEngine): vscode.Disposable => {
      const positronApi = tryAcquirePositronApi();
      if (positronApi) {
        return positronApi.languages.registerHelpTopicProvider('quarto',
          new EmbeddedHelpTopicProvider(engine));
      }
      return new vscode.Disposable(() => { });
    },

    createPreviewPanel: (
      viewType: string,
      title: string,
      preserveFocus?: boolean,
      options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
    ): HostWebviewPanel => {

      // create preview panel
      // (this host is only used when the Positron API is available)
      const panel = tryAcquirePositronApi()!.window.createPreviewPanel(
        viewType,
        title,
        preserveFocus,
        {
          enableScripts: options?.enableScripts,
          enableForms: options?.enableForms,
          localResourceRoots: options?.localResourceRoots,
          portMapping: options?.portMapping
        }
      );

      // adapt to host interface
      return new PositronWebviewPanel(panel);
    }
  };
}


/**
 * A cell executor that hands `language` cells to Positron.
 *
 * `language` is the cell's language and `runtimeLanguage` the language id of
 * the runtime that runs it; they differ for e.g. a `{sql}` cell that Positron
 * runs in its ggsql runtime, or Python in a knitr document run through
 * reticulate. Everything here addresses a runtime, so it all uses the runtime
 * language: `executeCode`, the execute queue, and the `languageId` of
 * `executeSelection` / `executeAtPosition`, which picks the console session
 * to run in rather than describing the document (the code itself comes from
 * the Quarto document and its statement range provider). There is no "sql"
 * runtime for a `{sql}` cell to find. Positron maps inline execution itself,
 * from the document and cell ranges, so that takes neither.
 */
function positronCellExecutor(
  language: string,
  runtimeLanguage: string,
  document: vscode.TextDocument,
  engine: MarkdownEngine,
  outputChannel?: vscode.LogOutputChannel
): CellExecutor {
  return {
    execute: async (blocks: string[], editorUri?: vscode.Uri, executionMetadata?: Record<string, unknown>[]): Promise<void> => {
      const runtime = tryAcquirePositronApi()?.runtime;

      if (runtime === undefined) {
        // Can't do anything without a runtime
        return;
      }

      let executionLanguage = runtimeLanguage;
      if (
        language === "python" &&
        isKnitrDocument(document, engine) &&
        vscode.workspace.getConfiguration("quarto").get("cells.useReticulate", true)
      ) {
        executionLanguage = "r";
        blocks = blocks.map(pythonWithReticulate);
      }

      // Our callback executes each block sequentially
      const callback = async () => {
        for (let i = 0; i < blocks.length; i++) {
          const metadata = executionMetadata?.[i];

          // Track whether the runtime itself reported the failure. A
          // failure of the running code (a runtime error or syntax
          // error in the cell), an interrupt, or the session exiting are
          // all delivered through the execution observer's `onFailed`
          // callback before `executeCode` rejects. These are already
          // surfaced in the console, so we don't want to surface them
          // again. A rejection *without* `onFailed` having fired means
          // the code couldn't be submitted to the runtime at all (e.g.
          // no runtime is registered for the language), which is a
          // genuine problem worth reporting.
          let runtimeFailure = false;

          try {
            await runtime.executeCode(
              executionLanguage, // The language ID
              blocks[i],  // The code string to execute
              false,      // Whether to focus the console
              true,       // Whether to allow incomplete code to run
              undefined,  // The execution mode
              undefined,  // The error behavior
              { onFailed: () => { runtimeFailure = true; } }, // An execution observer
              undefined,  // The specific session ID in which to execute
              editorUri,  // The document URI
              metadata
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);

            if (!runtimeFailure) {
              // The code couldn't be submitted to the runtime. Log it
              // and let it propagate so the user finds out.
              outputChannel?.error(`Failed to execute ${executionLanguage} cell: ${message}`);
              throw err;
            }

            // The executed code raised an error (or was interrupted).
            // It's already reported in the console, so log it for the
            // record but don't let it propagate to the command handler,
            // which would surface it again as a notification popup.
            // https://github.com/posit-dev/positron/issues/9845
            outputChannel?.debug(`Error executing ${executionLanguage} cell: ${message}`);

            // Stop executing any subsequent blocks since one failed.
            break;
          }
        }
      };

      await ExecuteQueue.instance.add(executionLanguage, callback);
    },
    executeSelection: async (): Promise<void> => {
      await vscode.commands.executeCommand('workbench.action.positronConsole.executeCode', { languageId: runtimeLanguage });
    },
    executeAtPosition: async (uri: Uri, position: Position): Promise<Position> => {
      try {
        return await vscode.commands.executeCommand(
          'positron.executeCodeFromPosition',
          runtimeLanguage,
          uri,
          position
        ) as Position;
      } catch {
        // an error can happen, we think, if the statementRangeProvider errors
        console.error('error when using `positron.executeCodeFromPosition`');
      }
      return position;
    },
    executeInlineCells: async (documentUri: vscode.Uri, cellRanges: Range[], executionMetadata?: Record<string, unknown>[]): Promise<void> => {
      const runtime = tryAcquirePositronApi()?.runtime;

      if (runtime === undefined) {
        // Can't do anything without a runtime
        return;
      }

      await runtime.executeInlineCell(documentUri, cellRanges, executionMetadata);
    }
  };
}

/**
 * Whether this version of Positron shows a stop button for preview panels.
 * Older Positron versions return panels without `stoppable` and
 * `onDidRequestStop`, even though the API types declare them.
 */
function isStoppable(panel: positron.PreviewPanel): boolean {
  return "onDidRequestStop" in panel;
}

export class PositronWebviewPanel implements HostWebviewPanel {
  constructor(private readonly panel_: positron.PreviewPanel) { }

  get webview() { return this.panel_.webview; };
  get visible() { return this.panel_.visible; };
  reveal(_viewColumn?: vscode.ViewColumn, preserveFocus?: boolean) {
    this.panel_.reveal(preserveFocus);
  }
  onDidChangeViewState = this.panel_.onDidChangeViewState;
  onDidDispose = this.panel_.onDidDispose;
  onDidRequestStop = isStoppable(this.panel_) ? this.panel_.onDidRequestStop : undefined;
  dispose() { this.panel_.dispose(); };
  setStoppable(stoppable: boolean) {
    if (isStoppable(this.panel_)) {
      this.panel_.stoppable = stoppable;
    }
  }
}

class EmbeddedStatementRangeProvider implements HostStatementRangeProvider {
  private readonly _engine: MarkdownEngine;

  constructor(
    readonly engine: MarkdownEngine,
  ) {
    this._engine = engine;
  }

  async provideStatementRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken): Promise<positron.StatementRange | undefined> {
    const vdoc = await virtualDoc(document, position, this._engine, VirtualDocStyle.Block);

    if (!vdoc) {
      return undefined;
    }

    return await withVirtualDocUri(vdoc, document.uri, "statementRange", async (uri: vscode.Uri) => {
      try {
        const result = await vscode.commands.executeCommand<positron.StatementRange>(
          "vscode.executeStatementRangeProvider",
          uri,
          adjustedPosition(vdoc.language, position)
        );
        return { range: unadjustedRange(vdoc.language, result.range), code: result.code };
      } catch (err) {
        const positronApi = tryAcquirePositronApi();

        if (!positronApi) {
          throw err;
        }

        // TODO: Remove this once `apps/vscode/package.json` bumps to `"positron": "^2026.03.0"` or higher.
        // For now we avoid aggressive bumping due to https://github.com/posit-dev/positron/issues/11321.
        // We can't use `semver.lt()` because calendar versioning isn't compatible with semver due to the
        // leading `0` in `03`. Instead, we use lexicographic string comparison and rely on the year and
        // month to be zero padded so sorting always works correctly.
        if (positronApi.version < "2026.03.0") {
          throw err;
        }

        if (err instanceof positronApi.StatementRangeSyntaxError) {
          // Rethrow syntax error with unadjusted line number, so Positron's notification will
          // jump to the correct line
          throw new positronApi.StatementRangeSyntaxError(err.line ? unadjustedLine(vdoc.language, err.line) : undefined);
        } else {
          // Rethrow unrecognized error
          throw err;
        }
      }
    });
  };
}

class EmbeddedHelpTopicProvider implements HostHelpTopicProvider {
  private readonly _engine: MarkdownEngine;

  constructor(
    readonly engine: MarkdownEngine,
  ) {
    this._engine = engine;
  }

  async provideHelpTopic(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken): Promise<string | undefined> {
    const vdoc = await virtualDoc(document, position, this._engine);

    if (vdoc) {
      return await withVirtualDocUri(vdoc, document.uri, "helpTopic", async (uri: vscode.Uri) => {
        return await vscode.commands.executeCommand<string>(
          "positron.executeHelpTopicProvider",
          uri,
          adjustedPosition(vdoc.language, position),
          vdoc.language
        );
      });
    } else {
      return undefined;
    }
  };
}
