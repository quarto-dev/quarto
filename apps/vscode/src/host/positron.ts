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
import { isExecutableLanguageBlock, languageNameFromBlock } from 'quarto-core';
import {
  kHostCellRuntimeLanguagesCommand,
  kHostExplainUnrunnableCellCommand,
  onDidRefreshHostCellLanguages,
} from './cell-features';

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
 * in ggsql); see {@link cellRuntimeLanguages}.
 *
 * See also https://github.com/posit-dev/positron/issues/17432
 */
let contributedLanguages = new Set<string>();
const registeredLanguages = new Set<string>();
let trackingRuntimes = false;

function trackRuntimeLanguages() {
  const runtime = tryAcquirePositronApi()?.runtime;
  if (trackingRuntimes || runtime === undefined) {
    return;
  }
  trackingRuntimes = true;

  // the contributions are read synchronously, so they are known right away;
  // the subscriptions below live as long as the extension host
  contributedLanguages = contributedRuntimeLanguages(vscode.extensions.all);
  vscode.extensions.onDidChange(() => {
    contributedLanguages = contributedRuntimeLanguages(vscode.extensions.all);
  });

  runtime.getRegisteredRuntimes().then(
    (runtimes) => runtimes.forEach((metadata) => registeredLanguages.add(metadata.languageId)),
    () => { }
  );
  runtime.onDidRegisterRuntime((metadata) => registeredLanguages.add(metadata.languageId));
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
 * Cell languages this host hands to a Positron runtime of the same language
 * without asking (see `cellExecutorForLanguage` below).
 */
const kPositronRuntimeLanguages: ReadonlySet<string> = new Set(["julia", "python", "csharp", "r"]);

/**
 * Whether to ask Positron, through {@link kHostCellRuntimeLanguagesCommand},
 * whether and where it runs `language` cells. Not for a language this host
 * already knows how to run: one of {@link kPositronRuntimeLanguages}, one with
 * a Positron runtime of its own (which Positron decides the same way), or one
 * this extension has an executor for. In practice that leaves `{sql}`, which
 * Positron runs in ggsql except in a knitr document, and languages nothing
 * runs, which Positron may explain.
 */
function asksPositron(language: string): boolean {
  return !kPositronRuntimeLanguages.has(language)
    && !hasPositronRuntime(language)
    && !executableLanguages().includes(language);
}

/** Positron's answer, and whether it may be cached (a failure may not). */
interface CellRuntimeLanguagesAnswer {
  runtimes: Record<string, string>;
  cacheable: boolean;
}

/**
 * How long to trust that Positron lacks {@link kHostCellRuntimeLanguagesCommand}
 * before trying it again, in case Positron registers it after this extension
 * activates. Any configuration or extension change also tries again (see
 * {@link ensureCellRuntimeLanguagesCache}).
 */
const kCommandMissingRetryMs = 30_000;

/**
 * When {@link kHostCellRuntimeLanguagesCommand} was last found missing, so that
 * a Positron without it (e.g. stable) is not sent a failing command plus a
 * `getCommands` on every document version.
 */
let cellRuntimeLanguagesCommandMissingAt: number | undefined;

async function queryCellRuntimeLanguages(
  document: vscode.TextDocument,
  languages: string[],
  outputChannel?: vscode.LogOutputChannel
): Promise<CellRuntimeLanguagesAnswer> {
  // no prototype, so that looking up e.g. a `{constructor}` cell finds nothing
  const runtimes: Record<string, string> = Object.create(null);
  if (languages.length === 0) {
    return { runtimes, cacheable: true };
  }
  if (
    cellRuntimeLanguagesCommandMissingAt !== undefined &&
    Date.now() - cellRuntimeLanguagesCommandMissingAt < kCommandMissingRetryMs
  ) {
    return { runtimes, cacheable: true };
  }
  cellRuntimeLanguagesCommandMissingAt = undefined;
  try {
    const answer = await vscode.commands.executeCommand<unknown>(
      kHostCellRuntimeLanguagesCommand,
      document.uri,
      languages
    );
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      for (const language of languages) {
        // own keys only, for the same reason
        const runtime = Object.prototype.hasOwnProperty.call(answer, language)
          ? (answer as Record<string, unknown>)[language]
          : undefined;
        if (typeof runtime === "string" && runtime.length > 0) {
          runtimes[language] = runtime;
        }
      }
    }
    return { runtimes, cacheable: true };
  } catch (err) {
    // A Positron without the command runs nothing extra, which is an answer.
    // The command is called rather than probed for up front because Positron
    // can register it after this extension activates.
    // `false` keeps the underscore-prefixed id we are looking for
    const all = await vscode.commands.getCommands(false);
    if (!all.includes(kHostCellRuntimeLanguagesCommand)) {
      // the cache's listeners also forget this on the next refresh
      ensureCellRuntimeLanguagesCache();
      cellRuntimeLanguagesCommandMissingAt = Date.now();
      return { runtimes, cacheable: true };
    }
    outputChannel?.warn(`${kHostCellRuntimeLanguagesCommand} failed: ${err}`);
    return { runtimes, cacheable: false };
  }
}

/**
 * Ask Positron, in one call, which runtime runs each of `languages` in
 * `document`. Answers a record from each language Positron runs there to the
 * language id of its runtime (e.g. `{ sql: "ggsql" }`); a language it does not
 * run is absent. Answers `{}` when Positron lacks
 * {@link kHostCellRuntimeLanguagesCommand} or the command fails. Uncached: see
 * {@link cellRuntimeLanguages}.
 */
export async function hostCellRuntimeLanguages(
  document: vscode.TextDocument,
  languages: string[],
  outputChannel?: vscode.LogOutputChannel
): Promise<Record<string, string>> {
  return (await queryCellRuntimeLanguages(document, languages, outputChannel)).runtimes;
}

interface CellRuntimeLanguagesEntry {
  version: number;
  asked: ReadonlySet<string>;
  answer: Promise<Record<string, string>>;
}

/** Shared by every {@link positronExtensionHost}; see {@link cellRuntimeLanguages}. */
let cellRuntimeLanguagesCache: Map<string, CellRuntimeLanguagesEntry> | undefined;

/**
 * The cache of {@link cellRuntimeLanguages}, created with its listeners on
 * first use: one cache, and one pair of listeners, for the life of the
 * extension. {@link positronExtensionHost} calls this so that the listener
 * that drops the cache on {@link onDidRefreshHostCellLanguages} is registered
 * before any visual editor's listener for the same event. Listeners run in
 * the order they were added, so a visual editor that re-asks on that event
 * then gets a fresh answer rather than the stale cached one.
 */
function ensureCellRuntimeLanguagesCache(): Map<string, CellRuntimeLanguagesEntry> {
  if (!cellRuntimeLanguagesCache) {
    const cache = new Map<string, CellRuntimeLanguagesEntry>();
    onDidRefreshHostCellLanguages(() => {
      cache.clear();
      cellRuntimeLanguagesCommandMissingAt = undefined;
    });
    vscode.workspace.onDidCloseTextDocument((closed) => cache.delete(closed.uri.toString()));
    cellRuntimeLanguagesCache = cache;
  }
  return cellRuntimeLanguagesCache;
}

/**
 * {@link hostCellRuntimeLanguages}, for the `languages` that {@link asksPositron},
 * cached per document version so that one run, code lens pass or visual editor
 * init makes one call per document: callers ask about every cell language in
 * the document, and a later question about a subset of those is answered from
 * the cache. Positron's answer depends only on
 * settings, installed extensions and the document's front matter, so the cache
 * is dropped on {@link onDidRefreshHostCellLanguages} (any configuration or
 * extension change), and an edit (which is how front matter changes) moves the
 * document to a new version. A failed call is not cached.
 */
function cellRuntimeLanguages(
  document: vscode.TextDocument,
  languages: string[],
  outputChannel?: vscode.LogOutputChannel
): Promise<Record<string, string>> {
  const wanted = languages.filter(asksPositron);
  if (wanted.length === 0) {
    return Promise.resolve(Object.create(null));
  }

  const cache = ensureCellRuntimeLanguagesCache();

  const key = document.uri.toString();
  const cached = cache.get(key);
  const current = cached?.version === document.version ? cached : undefined;
  if (current && wanted.every((language) => current.asked.has(language))) {
    return current.answer;
  }
  const asked = new Set([...(current?.asked ?? []), ...wanted]);
  const entry: CellRuntimeLanguagesEntry = {
    version: document.version,
    asked,
    answer: queryCellRuntimeLanguages(document, [...asked], outputChannel).then((answer) => {
      if (!answer.cacheable && cache.get(key) === entry) {
        cache.delete(key);
      }
      return answer.runtimes;
    }),
  };
  cache.set(key, entry);
  return entry.answer;
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

/** The languages of the executable cells in `document`. */
function documentCellLanguages(document: vscode.TextDocument, engine: MarkdownEngine): string[] {
  const languages = new Set<string>();
  for (const token of engine.parse(document)) {
    if (isExecutableLanguageBlock(token)) {
      languages.add(languageNameFromBlock(token));
    }
  }
  return [...languages];
}

export function positronExtensionHost(outputChannel?: vscode.LogOutputChannel): ExtensionHost {
  trackRuntimeLanguages();
  ensureCellRuntimeLanguagesCache();
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages), plus any language with a
    // Positron runtime
    executableLanguages: () => [...new Set([...executableLanguages(), ...positronRuntimeLanguages()])],

    // let Positron say why a cell cannot be run (e.g. that it runs at render)
    explainNoExecutor: (language: string, document: vscode.TextDocument): Promise<boolean> =>
      hostExplainUnrunnableCell(language, document, outputChannel),

    // the cell languages, beyond executableLanguages above, that Positron
    // says it runs in this document
    hostExecutableLanguages: async (document: vscode.TextDocument, languages: string[]): Promise<string[]> => {
      const runtimes = await cellRuntimeLanguages(document, languages, outputChannel);
      return languages.filter((language) => language in runtimes);
    },

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean)
      : Promise<CellExecutor | undefined> => {
      // use positron api for known runtimes, and for any other language with
      // a Positron runtime (e.g. SAS or ggsql from an extension)
      if (kPositronRuntimeLanguages.has(language) || hasPositronRuntime(language)) {
        return positronCellExecutor(language, language, document, engine, outputChannel);
      }

      // ask Positron whether it runs any other language it may run (e.g. sql
      // in ggsql), otherwise delegate. Ask about every such cell language in
      // the document, which is the question the run filters and code lenses
      // ask too, so the answer for this document version is shared rather
      // than asked again
      if (asksPositron(language)) {
        const runtimes = await cellRuntimeLanguages(
          document,
          [language, ...documentCellLanguages(document, engine)],
          outputChannel
        );
        const runtimeLanguage = runtimes[language];
        if (runtimeLanguage !== undefined) {
          return positronCellExecutor(language, runtimeLanguage, document, engine, outputChannel);
        }
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
