/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import debounce from "lodash.debounce";
import {
  ExtensionContext,
  Uri,
  WebviewPanel,
  window,
  Position,
  ViewColumn,
} from "vscode";
import { isGraphvizDoc, isMermaidDoc, isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isDiagram,
  languageBlockAtPosition,
  languageNameFromBlock,
} from "../../markdown/language";
import { QuartoWebview, QuartoWebviewManager } from "../webview";

const kDiagramViewId = "quarto.diagramView";

export interface DiagramState {
  engine: "mermaid" | "graphviz";
  src: string;
}

export class QuartoDiagramWebviewManager extends QuartoWebviewManager<
  QuartoDiagramWebview,
  null
> {
  constructor(
    context: ExtensionContext,
    private readonly engine_: MarkdownEngine
  ) {
    super(context, kDiagramViewId, "Quarto: Diagram", QuartoDiagramWebview);

    window.onDidChangeActiveTextEditor(
      () => {
        this.updatePreview();
      },
      null,
      this.disposables_
    );

    window.onDidChangeTextEditorSelection(
      debounce(() => {
        this.updatePreview();
      }, 500),
      null,
      this.disposables_
    );
  }

  public showDiagram() {
    this.setOnShow(this.updatePreview.bind(this));
    if (this.activeView_) {
      this.revealWebview();
    } else {
      this.showWebview(null, {
        preserveFocus: true,
        viewColumn: ViewColumn.Beside,
      });
    }
  }

  protected override onViewStateChanged(): void {
    this.updatePreview();
  }

  private async updatePreview() {
    if (this.isVisible()) {
      // get the active editor
      if (window.activeTextEditor) {
        const doc = window.activeTextEditor.document;
        if (isQuartoDoc(doc) && window.activeTextEditor.selection) {
          // if we are in a diagram block then send its contents
          const tokens = await this.engine_.parse(doc);
          const line = window.activeTextEditor.selection.start.line;
          const block = languageBlockAtPosition(tokens, new Position(line, 0));
          if (block && isDiagram(block)) {
            const language = languageNameFromBlock(block);
            this.activeView_?.update({
              engine: language === "dot" ? "graphviz" : "mermaid",
              src: block.content,
            });
          }
        } else if (isMermaidDoc(doc)) {
          this.activeView_?.update({
            engine: "mermaid",
            src: doc.getText(),
          });
        } else if (isGraphvizDoc(doc)) {
          this.activeView_?.update({
            engine: "graphviz",
            src: doc.getText(),
          });
        }
      }
    }
  }
}

class QuartoDiagramWebview extends QuartoWebview<null> {
  public constructor(
    extensionUri: Uri,
    state: null,
    webviewPanel: WebviewPanel
  ) {
    super(extensionUri, state, webviewPanel);

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage((e) => {
        switch (e.type) {
          case "initialized": {
            this.initialized_ = true;
            if (this.pendingState_) {
              this.flushPendingState();
            }
            break;
          }
          case "render-begin": {
            this.rendering_ = true;
            break;
          }
          case "render-end": {
            this.rendering_ = false;
            if (this.pendingState_) {
              this.flushPendingState();
            }
            break;
          }
        }
      })
    );
  }

  public update(state?: DiagramState) {
    if (!this.initialized_ || this.rendering_) {
      this.pendingState_ = state;
    } else if (state) {
      this._webviewPanel.webview.postMessage({
        type: "render",
        ...state,
      });
    } else {
      this._webviewPanel.webview.postMessage({
        type: "clear",
      });
    }
  }

  protected getHtml(_state: null): string {
    const headerHtml = ``;

    const bodyHtml = `
      <div id="no-preview"></div>
      <div id="preview-error" class="hidden">
        <pre id="preview-error-message">
        </pre>
      </div>
      <div id="mermaid-preview" class="diagram-preview"></div>
      <div id="graphviz-preview" class="diagram-preview"></div>
    `;

    return this.webviewHTML(
      [
        this.assetPath("lodash.min.js"),
        this.assetPath("mermaid.min.js"),
        this.assetPath("d3.v5.min.js"),
        this.assetPath("graphviz.min.js"),
        this.assetPath("d3-graphviz.js"),
        this.assetPath("diagram.js"),
      ],
      this.assetPath("diagram.css"),
      headerHtml,
      bodyHtml,
      true
    );
  }

  private flushPendingState() {
    const state = this.pendingState_;
    this.pendingState_ = undefined;
    this.update(state);
  }

  private assetPath(asset: string) {
    return ["assets", "www", "diagram", asset];
  }

  private initialized_ = false;
  private rendering_ = false;
  private pendingState_: DiagramState | undefined;
}
