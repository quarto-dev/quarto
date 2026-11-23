/*
 * preview-webview.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import {
  env,
  Uri,
  window,
  ColorThemeKind,
  ExtensionContext,
  workspace,
  commands,
} from "vscode";
import { QuartoWebview, QuartoWebviewManager } from "../webview";
import { HostWebviewPanel } from "../../host";
import { previewCommandPermission } from "./command-permissions";
import { isPreviewCommandMessage } from "./command-bridge";
import { dispatchPreviewCommand, PreviewCommandError } from "./command-links";

const kQuarotPreviewZoomLevel = "quartoPreviewZoomLevel";

export interface QuartoPreviewState {
  url: string;
  commandToken?: string;
  zoomLevel?: "auto" | number;
  slideIndex?: number;
}

export class QuartoPreviewWebviewManager extends QuartoWebviewManager<
  QuartoPreviewWebview,
  QuartoPreviewState
> {
  // Revocation does not require closing the panel; an old document may remain
  // visible while its server stops or a replacement preview starts.
  public disableCommands() {
    this.activeView_?.disableCommands();
  }

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
  public setOnError(handler: () => void) {
    if (this.activeView_) {
      this.activeView_.setOnError(handler);
    }
  }
  public getZoomLevelConfig(): "auto" | number {
    return this.context.globalState.get<"auto" | number>(kQuarotPreviewZoomLevel, "auto");
  }
}

export class QuartoPreviewWebview extends QuartoWebview<QuartoPreviewState> {
  public constructor(
    context: ExtensionContext,
    state: QuartoPreviewState,
    webviewPanel: HostWebviewPanel
  ) {
    super(context, state, webviewPanel);
    // getHtml also records updates when this same panel is reused later.
    this.commandState_ = state;

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage(async (e) => {
        if (!e || typeof e !== "object") {
          return;
        }
        switch (e.type) {
          case "openExternal":
            try {
              const url = Uri.parse(e.url);
              // A command URL requests work in the editor, not ordinary browser
              // navigation. Intercept it in the extension host before reaching
              // openExternal. URI schemes are case-insensitive; command IDs are
              // not, so normalize only the scheme used for this comparison.
              if (url.scheme.toLowerCase() === "command") {
                // The old relay loses data-args and cannot validate conflicts.
                void window.showErrorMessage("Command links require an integrated HTML preview with the command bridge enabled.");
                // Stop here so command URLs never reach env.openExternal().
                break;
              }
              env.openExternal(url);
            } catch {
              // Noop
            }
            break;
          case "previewError":
            if (this.onError_) {
              this.onError_();
            }
            break;
          case "zoomLevelChanged":
            context.globalState.update(kQuarotPreviewZoomLevel, e.msg);
            break;
          case "quarto.preview.command": {
            // Treat relay messages as untrusted input even after browser checks.
            if (!isPreviewCommandMessage(e, this.commandState_.commandToken, this.commandState_.url)) {
              break;
            }
            // Bind the parser/dispatcher to VS Code here. The permission callback
            // reads current trust and User/Remote settings on every invocation;
            // inspect() avoids a workspace value granting command permission.
            const result = await dispatchPreviewCommand(e.link, {
              createUri: components => Uri.from(components),
              permission: id => previewCommandPermission(
                id, workspace.isTrusted,
                workspace.getConfiguration("quarto.preview").inspect("allowedCommands")
              ),
              executeCommand: (id, ...args) => commands.executeCommand(id, ...args),
            });
            // Report failures without revealing command arguments or exceptions.
            if (result.status === "invalid") {
              void window.showErrorMessage(new PreviewCommandError(result.reason).message);
            } else if (result.status === "failed") {
              void window.showErrorMessage("Preview command failed. Check that the command is available and its arguments are valid.");
            } else if (result.status === "blocked") {
              switch (result.permission) {
                case "untrusted-workspace":
                  void window.showErrorMessage("Quarto preview command links require a trusted workspace.");
                  break;
                case "invalid-configuration":
                  void window.showErrorMessage("Quarto Preview: Allowed Commands must be an array of nonempty command IDs without whitespace in User or Remote User Settings.");
                  break;
                case "not-allowed":
                  void window.showErrorMessage("This preview command is blocked. Only allow it in Quarto Preview: Allowed Commands in User or Remote User Settings if you trust the document.");
                  break;
              }
            }
            break;
          }
        }
      })
    );

    this._register(
      window.onDidChangeActiveColorTheme((_e) => {
        this._webviewPanel.webview.postMessage({
          type: "didChangeActiveColorTheme",
          theme:
            window.activeColorTheme.kind === ColorThemeKind.Light
              ? "light"
              : "dark",
        });
      })
    );
  }

  public setOnError(handler: () => void) {
    this.onError_ = handler;
  }

  public clear() {
    // Stop accepting queued clicks before telling the browser to clear its page.
    this.disableCommands();
    this._webviewPanel.webview.postMessage({
      type: "clear",
    });
  }

  public disableCommands() {
    // Host-side revocation is sufficient even if an old iframe still has its
    // token: its next message will no longer match the active command state.
    this.commandState_ = { ...this.commandState_, commandToken: undefined };
  }

  public setSlideIndex(slideIndex?: number) {
    this._webviewPanel.webview.postMessage({
      type: "setSlideIndex",
      index: slideIndex,
    });
  }

  protected getHtml(state: QuartoPreviewState): string {
    // A reused panel must reject messages from the previous preview session.
    this.commandState_ = state;

    const headerHtml = `
    <meta id="simple-browser-settings" data-settings="${this.escapeAttribute(
      JSON.stringify({
        url: state.url,
        // The browser relay uses the same session that the host validates.
        commandToken: state.commandToken,
        zoomLevel: state.zoomLevel,
        slideIndex: state.slideIndex
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
        <select id="zoom">
          <option value="auto">Zoom: (Auto)</option>
          <option value="70">Zoom: 70%</option>
          <option value="80">Zoom: 80%</option>
          <option value="90">Zoom: 90%</option>
          <option value="100">Zoom: 100%</option>
        </select>
        <button
          title="Open in browser"
          class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
      </nav>
    </header>
    <div class="content">
      <iframe sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock allow-downloads"></iframe>
    </div>
    `;

    return this.webviewHTML(
      [this.assetPath("index.js")],
      this.assetPath("main.css"),
      headerHtml,
      bodyHtml,
      true
    );
  }

  private assetPath(asset: string) {
    return ["assets", "www", "preview", asset];
  }

  private onError_: (() => void) | undefined;
  // Keep the current session separately from HTML already sent to the browser.
  private commandState_: QuartoPreviewState;
}
