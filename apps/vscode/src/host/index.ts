/*
 * index.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import vscode, { DocumentSelector, Disposable, WebviewPanelOptions, WebviewOptions, window } from "vscode";


import { CellExecutor, cellExecutorForLanguage, executableLanguages, isKnitrDocument } from "./executors";
import { EditorToolbarProvider } from "./toolbar";
import { positronExtensionHost } from "./positron";
import { TextDocument } from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import { WebviewPanel } from "vscode";
import { ViewColumn } from "vscode";
import { tryAcquirePositronApi } from "@posit-dev/positron";

export type { CellExecutor };
export type { EditorToolbarProvider, ToolbarItem, ToolbarCommand, ToolbarButton, ToolbarMenu } from './toolbar';

export interface HostWebviewPanel extends vscode.Disposable {
  readonly webview: vscode.Webview;
  readonly visible: boolean;
  reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void;
  readonly onDidChangeViewState: vscode.Event<unknown>;
  readonly onDidDispose: vscode.Event<void>;
  setStoppable?(stoppable: boolean): void;
  readonly onDidRequestStop?: vscode.Event<void>;
}

export interface HostStatementRangeProvider {
  provideStatementRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<HostStatementRange>;
}

export interface HostStatementRange {
  readonly range: vscode.Range;
  readonly code?: string;
}

export interface HostHelpTopicProvider {
  provideHelpTopic(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<string>;
}

/**
 * There are currently two extension hosts:
 * - [`positronExtensionHost`](./positron.ts) for Positron
 * - [`defaultExtensionHost`](./index.ts) otherwise
 */
export interface ExtensionHost {

  // code execution
  executableLanguages(visualMode: boolean, document: TextDocument, engine: MarkdownEngine): string[];
  cellExecutorForLanguage(
    language: string,
    document: TextDocument,
    engine: MarkdownEngine,
    silent?: boolean
  ): Promise<CellExecutor | undefined>;

  /**
   * The language of the runtime that runs `language` cells in `document`.
   * Cells that share a runtime run together in Run All, Run Above and Run
   * Below (e.g. `{sql}` and `{ggsql}` cells in Positron). Without it, or when
   * it answers undefined, each cell language is its own runtime.
   */
  cellRuntimeLanguage?(language: string, document: TextDocument, engine: MarkdownEngine): string | undefined;

  /**
   * The code that runs a `language` cell in its runtime, when cells of
   * several languages run together through the runtime's executor: e.g. an
   * `{Rcpp}` cell runs with `{r}` cells as an `Rcpp::sourceCpp()` call.
   * Without it, each cell runs its own code.
   */
  cellCodeForRuntime?(language: string, code: string, document: TextDocument, engine: MarkdownEngine): string;

  /**
   * Explain to the user why a `language` cell in `document` has no executor.
   * Answers whether it explained.
   */
  explainNoExecutor?(language: string, document: TextDocument): Promise<boolean>;

  // statement range provider
  registerStatementRangeProvider(
    engine: MarkdownEngine,
  ): vscode.Disposable;

  // help topic provider
  registerHelpTopicProvider(
    engine: MarkdownEngine,
  ): vscode.Disposable;

  // preview
  createPreviewPanel(
    viewType: string,
    title: string,
    preserveFocus?: boolean,
    options?: WebviewPanelOptions & WebviewOptions
  ): HostWebviewPanel;

  // editor toolbar
  registerEditorToolbarProvider?(
    selector: DocumentSelector,
    provider: EditorToolbarProvider
  ): Disposable;

}

export function extensionHost(outputChannel?: vscode.LogOutputChannel): ExtensionHost {
  if (tryAcquirePositronApi()) {
    return positronExtensionHost(outputChannel);
  } else {
    return defaultExtensionHost();
  }
}

function defaultExtensionHost(): ExtensionHost {
  return {
    executableLanguages: (visualMode: boolean, document: TextDocument, engine: MarkdownEngine) => {

      const languages = executableLanguages();
      const knitr = isKnitrDocument(document, engine);

      // jupyter python (as distinct from knitr python) doesn't work in visual mode b/c
      // jupyter.execSelectionInteractive  wants a text editor to be active
      return languages.filter(language => knitr || !visualMode || (language !== "python"));
    },
    cellExecutorForLanguage,
    // In contrast to the Positron-specific `hooksExtensionHost`, here in the default host we
    // do not have statement range or help topic functionality
    registerStatementRangeProvider: doNothing,
    registerHelpTopicProvider: doNothing,
    createPreviewPanel: (
      viewType: string,
      title: string,
      preserveFocus?: boolean,
      options?: WebviewPanelOptions & WebviewOptions
    ): WebviewPanel => {
      return window.createWebviewPanel(viewType, title, { viewColumn: ViewColumn.Beside, preserveFocus, }, options);
    }
  };
}

const doNothing = (_engine: MarkdownEngine): vscode.Disposable =>
  new vscode.Disposable(() => { });
