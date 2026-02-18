/*
 * hooks.ts
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
import * as hooks from 'positron';

import { ExtensionHost, HostWebviewPanel, HostStatementRangeProvider, HostHelpTopicProvider } from '.';
import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument, pythonWithReticulate } from './executors';
import { ExecuteQueue } from './execute-queue';
import { MarkdownEngine } from '../markdown/engine';
import { virtualDoc, adjustedPosition, unadjustedRange, withVirtualDocUri, VirtualDocStyle, unadjustedLine } from "../vdoc/vdoc";
import { Position, Range } from 'vscode';
import { Uri } from 'vscode';

/**
 * Check if inline output is enabled in Positron settings.
 * This helper is shared with main.ts for code lens visibility.
 */
export function isInlineOutputEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("positron.quarto.inlineOutput")
    .get<boolean>("enabled", false);
}

declare global {
  function acquirePositronApi(): hooks.PositronApi;
}

let api: hooks.PositronApi | null | undefined;

export function hooksApi(): hooks.PositronApi | null {
  if (api === undefined) {
    try {
      api = acquirePositronApi();
    } catch {
      api = null;
    }
  }
  return api;
}

export function hasHooks() {
  return !!hooksApi();
}

export function hooksExtensionHost(): ExtensionHost {
  return {
    // supported executable languages (we delegate to the default for langugaes
    // w/o runtimes so we support all languages)
    executableLanguages,

    cellExecutorForLanguage: async (language: string, document: vscode.TextDocument, engine: MarkdownEngine, silent?: boolean)
      : Promise<CellExecutor | undefined> => {
      switch (language) {
        // use hooks for known runtimes
        case "python":
        case "csharp":
        case "r":
          return {
            execute: async (blocks: string[], editorUri?: vscode.Uri): Promise<void> => {
              const runtime = hooksApi()?.runtime;

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
                for (const block of blocks) {
                  await runtime.executeCode(language, block, false, true);
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
            executeInlineCells: async (documentUri: vscode.Uri, cellRanges: Range[]): Promise<void> => {
              const runtime = hooksApi()?.runtime;

              if (runtime === undefined) {
                // Can't do anything without a runtime
                return;
              }

              await runtime.executeInlineCell(documentUri, cellRanges);
            }
          };

        // delegate for other languages
        default:
          return cellExecutorForLanguage(language, document, engine, silent);
      }
    },

    registerStatementRangeProvider: (engine: MarkdownEngine): vscode.Disposable => {
      const hooks = hooksApi();
      if (hooks) {
        return hooks.languages.registerStatementRangeProvider('quarto',
          new EmbeddedStatementRangeProvider(engine));
      }
      return new vscode.Disposable(() => { });
    },

    registerHelpTopicProvider: (engine: MarkdownEngine): vscode.Disposable => {
      const hooks = hooksApi();
      if (hooks) {
        return hooks.languages.registerHelpTopicProvider('quarto',
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
      const panel = hooksApi()?.window.createPreviewPanel(
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
      return new HookWebviewPanel(panel);
    }
  };
}


class HookWebviewPanel implements HostWebviewPanel {
  constructor(private readonly panel_: hooks.PreviewPanel) { }

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
    token: vscode.CancellationToken): Promise<hooks.StatementRange | undefined> {
    const vdoc = await virtualDoc(document, position, this._engine, VirtualDocStyle.Block);

    if (!vdoc) {
      return undefined;
    }

    return await withVirtualDocUri(vdoc, document.uri, "statementRange", async (uri: vscode.Uri) => {
      try {
        const result = await vscode.commands.executeCommand<hooks.StatementRange>(
          "vscode.executeStatementRangeProvider",
          uri,
          adjustedPosition(vdoc.language, position)
        );
        return { range: unadjustedRange(vdoc.language, result.range), code: result.code };
      } catch (err) {
        if (err instanceof hooks.StatementRangeSyntaxError) {
          // Rethrow syntax error with unadjusted line number, so Positron's notification will
          // jump to the correct line
          throw new hooks.StatementRangeSyntaxError(err.line ? unadjustedLine(vdoc.language, err.line) : undefined);
        }
        throw err;
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
