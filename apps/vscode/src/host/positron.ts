/*
 * positron.ts
 *
 * Positron-specific functionality.
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
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
 * Check if inline output is enabled in Positron settings.
 * This helper is shared with main.ts for code lens visibility.
 */
export function isInlineOutputEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("positron.quarto.inlineOutput")
    .get<boolean>("enabled", false);
}

export function positronExtensionHost(outputChannel?: vscode.LogOutputChannel): ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages)
    executableLanguages,

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean)
      : Promise<CellExecutor | undefined> => {
      switch (language) {
        // use positron api for known runtimes
        case "python":
        case "csharp":
        case "r":
          return {
            execute: async (blocks: string[], editorUri?: vscode.Uri, executionMetadata?: Record<string, unknown>[]): Promise<void> => {
              const runtime = tryAcquirePositronApi()?.runtime;

              if (runtime === undefined) {
                // Can't do anything without a runtime
                return;
              }

              if (language === "python" && isKnitrDocument(document, engine)) {
                language = "r";
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
                      language,   // The language ID
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
                      outputChannel?.error(`Failed to execute ${language} cell: ${message}`);
                      throw err;
                    }

                    // The executed code raised an error (or was interrupted).
                    // It's already reported in the console, so log it for the
                    // record but don't let it propagate to the command handler,
                    // which would surface it again as a notification popup.
                    // https://github.com/posit-dev/positron/issues/9845
                    outputChannel?.debug(`Error executing ${language} cell: ${message}`);

                    // Stop executing any subsequent blocks since one failed.
                    break;
                  }
                }
              };

              await ExecuteQueue.instance.add(language, callback);
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
              } catch (e) {
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

        // delegate for other languages
        default:
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
      const panel = tryAcquirePositronApi()?.window.createPreviewPanel(
        viewType,
        title,
        preserveFocus,
        {
          enableScripts: options?.enableScripts,
          enableForms: options?.enableForms,
          localResourceRoots: options?.localResourceRoots,
          portMapping: options?.portMapping
        }
      )!;

      // adapt to host interface
      return new PositronWebviewPanel(panel);
    }
  };
}


class PositronWebviewPanel implements HostWebviewPanel {
  constructor(private readonly panel_: positron.PreviewPanel) { }

  get webview() { return this.panel_.webview; };
  get visible() { return this.panel_.visible; };
  reveal(_viewColumn?: vscode.ViewColumn, preserveFocus?: boolean) {
    this.panel_.reveal(preserveFocus);
  }
  onDidChangeViewState = this.panel_.onDidChangeViewState;
  onDidDispose = this.panel_.onDidDispose;
  dispose() { this.panel_.dispose(); };
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
    token: vscode.CancellationToken): Promise<positron.StatementRange | undefined> {
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
        let positronApi = tryAcquirePositronApi();

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
    token: vscode.CancellationToken): Promise<string | undefined> {
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
