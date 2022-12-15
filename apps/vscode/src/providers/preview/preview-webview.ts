/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  env,
  Uri,
  WebviewPanel,
  workspace,
  window,
  ColorThemeKind,
} from "vscode";
import { QuartoWebview, QuartoWebviewManager } from "../webview";

export class QuartoPreviewWebviewManager extends QuartoWebviewManager<
  QuartoPreviewWebview,
  string
> {
  public clear() {
    if (this.activeView_) {
      this.activeView_.clear();
    }
  }
  public setSlideIndex(slideIndex?: number) {
    if (this.activeView_) {
      this.activeView_.setSlideIndex(slideIndex);
    }
  }
  public setOnError(handler: (msg: string) => void) {
    if (this.activeView_) {
      this.activeView_.setOnError(handler);
    }
  }
}

export class QuartoPreviewWebview extends QuartoWebview<string> {
  public constructor(
    extensionUri: Uri,
    state: string,
    webviewPanel: WebviewPanel
  ) {
    super(extensionUri, state, webviewPanel);

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage((e) => {
        switch (e.type) {
          case "openExternal":
            try {
              const url = Uri.parse(e.url);
              env.openExternal(url);
            } catch {
              // Noop
            }
            break;
          case "previewError":
            if (this.onError_) {
              this.onError_(e.msg);
            }
            break;
        }
      })
    );

    this._register(
      workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("simpleBrowser.focusLockIndicator.enabled")
        ) {
          const configuration = workspace.getConfiguration("simpleBrowser");
          this._webviewPanel.webview.postMessage({
            type: "didChangeFocusLockIndicatorEnabled",
            focusLockEnabled: configuration.get<boolean>(
              "focusLockIndicator.enabled",
              true
            ),
          });
        }
      })
    );

    this._register(
      window.onDidChangeActiveColorTheme((_e) => {
        this._webviewPanel.webview.postMessage({
          type: "didChangeActiveColorTheme",
          theme:
            window.activeColorTheme.kind == ColorThemeKind.Light
              ? "light"
              : "dark",
        });
      })
    );
  }

  public setOnError(handler: (msg: string) => void) {
    this.onError_ = handler;
  }

  public clear() {
    this._webviewPanel.webview.postMessage({
      type: "clear",
    });
  }

  public setSlideIndex(slideIndex?: number) {
    this._webviewPanel.webview.postMessage({
      type: "setSlideIndex",
      index: slideIndex,
    });
  }

  protected getHtml(state: string): string {
    const configuration = workspace.getConfiguration("simpleBrowser");

    const headerHtml = `
    <meta id="simple-browser-settings" data-settings="${this.escapeAttribute(
      JSON.stringify({
        url: state,
        focusLockEnabled: configuration.get<boolean>(
          "focusLockIndicator.enabled",
          true
        ),
      })
    )}">
    `;

    const bodyHtml = `
    <header class="header">
      <nav class="controls">
        <button
          title="Back"
          class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

        <button
          title="Forward"
          class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

        <button
          title="Reload"
          class="reload-button icon"><i class="codicon codicon-refresh"></i></button>
      </nav>

      <input class="url-input" type="text">

      <nav class="controls">
        <button
          title="Open in browser"
          class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
      </nav>
    </header>
    <div class="content">
      <div class="iframe-focused-alert">Focus Lock</div>
      <iframe sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock allow-downloads"></iframe>
    </div>
    
    `;

    return this.webviewHTML(
      [this.assetPath("index.js")],
      this.assetPath("main.css"),
      headerHtml,
      bodyHtml
    );
  }

  private assetPath(asset: string) {
    return ["assets", "www", "preview", asset];
  }

  private onError_: ((msg: string) => void) | undefined;
}
