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
 * Languages whose cells can run in a Positron console. They come from two
 * sources, as in Positron's own check for inline output
 * (`hasLanguageRuntimeProvider`):
 *
 * - the `languageRuntimes` contributions of the installed extensions, which
 *   are known before those extensions activate or discover any runtime, and
 * - the registered runtimes, for an extension that registers a runtime
 *   without declaring the contribution.
 *
 * Both are cached because the checks for whether a cell can run are
 * synchronous. They are tracked only in Positron, so nothing changes in
 * VS Code even when such extensions are installed.
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
 * Cell executor that runs code in the Positron console of the language.
 */
function positronRuntimeExecutor(
  language: string,
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

      let executionLanguage = language;
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
      await vscode.commands.executeCommand('workbench.action.positronConsole.executeCode', { languageId: language });
    },
    executeAtPosition: async (uri: Uri, position: Position): Promise<Position> => {
      try {
        return await vscode.commands.executeCommand(
          'positron.executeCodeFromPosition',
          language,
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

export function positronExtensionHost(outputChannel?: vscode.LogOutputChannel): ExtensionHost {
  trackRuntimeLanguages();
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages), plus any language with a
    // Positron runtime
    executableLanguages: () => [...new Set([...executableLanguages(), ...positronRuntimeLanguages()])],

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean)
      : Promise<CellExecutor | undefined> => {
      switch (language) {
        // use positron api for known runtimes
        case "julia":
        case "python":
        case "csharp":
        case "r":
          return positronRuntimeExecutor(language, document, engine, outputChannel);

        // use positron api for any other language with a Positron runtime
        // (e.g. SAS or ggsql from an extension), and delegate the rest
        default:
          if (hasPositronRuntime(language)) {
            return positronRuntimeExecutor(language, document, engine, outputChannel);
          }
          return cellExecutorForLanguage(language, document, engine, silent);
      }
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
