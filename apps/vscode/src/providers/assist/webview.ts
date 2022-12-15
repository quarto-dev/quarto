/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// https://code.visualstudio.com/api/extension-guides/webview

import {
  WebviewViewProvider,
  WebviewView,
  Uri,
  window,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  CancellationTokenSource,
  ExtensionContext,
  workspace,
  commands,
} from "vscode";

import debounce from "lodash.debounce";

import { MarkdownEngine } from "../../markdown/engine";
import {
  createRenderCacheKey,
  RenderCacheKey,
  renderCacheKeyEquals,
  renderCacheKeyNone,
} from "./render-cache";
import { renderActiveAssist, renderWebviewHtml } from "./render-assist";

enum UpdateMode {
  Sticky = "sticky",
  Live = "live",
}

export class QuartoAssistViewProvider
  implements WebviewViewProvider, Disposable
{
  public static readonly viewType = "quarto-assist";

  constructor(context: ExtensionContext, _engine: MarkdownEngine) {
    this.extensionUri_ = context.extensionUri;

    window.onDidChangeActiveTextEditor(
      () => {
        if (this.view_?.visible) {
          this.render();
        }
      },
      null,
      this._disposables
    );

    window.onDidChangeTextEditorSelection(
      debounce(() => {
        if (this.view_?.visible) {
          this.render();
        }
      }, 500),
      null,
      this._disposables
    );

    workspace.onDidChangeConfiguration(
      () => {
        this.updateConfiguration();
      },
      null,
      this._disposables
    );

    this.updateConfiguration();

    this.render();
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext<unknown>,
    _token: CancellationToken
  ): void | Thenable<void> {
    this.view_ = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    };

    webviewView.onDidChangeVisibility(() => {
      if (this.view_?.visible) {
        this.render(true);
      }
    });

    webviewView.onDidDispose(() => {
      this.view_ = undefined;
    });

    webviewView.webview.html = renderWebviewHtml(
      webviewView.webview,
      this.extensionUri_
    );

    this.render(true);
  }

  public activate() {
    if (this.view_) {
      this.view_.show(true);
      return true;
    } else {
      return false;
    }
  }

  public pin() {
    this.updatePinned(true);
  }

  public unpin() {
    this.updatePinned(false);
  }

  public dispose() {
    let item: Disposable | undefined;
    while ((item = this._disposables.pop())) {
      item.dispose();
    }
  }

  private updatePinned(value: boolean) {
    if (this.pinned_ === value) {
      return;
    }

    this.pinned_ = value;
    commands.executeCommand(
      "setContext",
      QuartoAssistViewProvider.pinnedContext,
      value
    );

    this.render();
  }

  private async render(ignoreCache = false) {
    // ignore if we have no view
    if (!this.view_) {
      return;
    }

    // ignore if we are pinned
    if (this.pinned_) {
      return;
    }

    // don't render if the editor state hasn't changed (i.e. the cursor
    // isn't on a new word range)
    const newRenderCacheKey = createRenderCacheKey(window.activeTextEditor);
    if (
      !ignoreCache &&
      renderCacheKeyEquals(this.currentRenderCacheKey_, newRenderCacheKey)
    ) {
      return;
    }
    this.currentRenderCacheKey_ = newRenderCacheKey;

    // if we have a previous load in progress then cancel it
    if (this.rendering_) {
      this.rendering_.cts.cancel();
      this.rendering_ = undefined;
    }

    // set loading
    const renderingEntry = { cts: new CancellationTokenSource() };
    this.rendering_ = renderingEntry;

    // promise used to perform updates (this will be raced with a progress indicator)
    const renderPromise = (async () => {
      // get html
      const assist = await renderActiveAssist(
        (uri: Uri) => this.view_!.webview.asWebviewUri(uri),
        renderingEntry.cts.token
      );

      // check for cancel
      if (renderingEntry.cts.token.isCancellationRequested) {
        return;
      }

      // check for another render started after us
      if (this.rendering_ !== renderingEntry) {
        // A new entry has started loading since we started
        return;
      }
      this.rendering_ = undefined;

      // post update to view
      if (assist) {
        if (this.view_) {
          this.view_.webview.postMessage({
            type: "update",
            body: `<div class="${assist.type.toLowerCase()}">${
              assist.html
            }</div>`,
            updateMode: this.updateMode_,
          });
          this.view_.title = assist.type;
        }
      } else {
        if (this.view_) {
          this.view_?.webview.postMessage({
            type: "noContent",
            body: "The Quarto assist panel provides contextual help as you edit and live preview for images and equations.",
            updateMode: this.updateMode_,
          });
          if (this.updateMode_ === UpdateMode.Live) {
            this.view_.title = "Quarto";
          }
        }
      }
    })();

    // only show progress indicator if it takes longer than 250ms to render
    await Promise.race([
      renderPromise,

      new Promise<void>((resolve) => setTimeout(resolve, 250)).then(() => {
        if (renderingEntry.cts.token.isCancellationRequested) {
          return;
        }
        return window.withProgress(
          { location: { viewId: QuartoAssistViewProvider.viewType } },
          () => renderPromise
        );
      }),
    ]);
  }

  private updateConfiguration() {
    const config = workspace.getConfiguration("quarto");
    this.updateMode_ =
      config.get<UpdateMode>("assist.updateMode") || UpdateMode.Sticky;
  }

  private view_?: WebviewView;
  private readonly extensionUri_: Uri;
  private readonly _disposables: Disposable[] = [];

  private currentRenderCacheKey_: RenderCacheKey = renderCacheKeyNone;
  private rendering_?: { cts: CancellationTokenSource };

  private updateMode_ = UpdateMode.Sticky;
  private pinned_ = false;
  private static readonly pinnedContext = "quarto.assistView.isPinned";
}
