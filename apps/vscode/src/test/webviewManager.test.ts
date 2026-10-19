/*
 * webviewManager.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as vscode from "vscode";

import { ExtensionHost, HostWebviewPanel } from "../host";
import { QuartoWebview, QuartoWebviewManager } from "../providers/webview";

/** A preview panel that records what the manager does with the stop button. */
class FakePanel implements HostWebviewPanel {
  readonly webview = {
    html: "",
    cspSource: "",
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
  readonly visible = true;
  stoppable = false;
  disposed = false;

  private readonly onDidDispose_ = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.onDidDispose_.event;
  readonly onDidChangeViewState = new vscode.EventEmitter<unknown>().event;
  private readonly onDidRequestStop_ = new vscode.EventEmitter<void>();
  readonly onDidRequestStop = this.onDidRequestStop_.event;

  setStoppable(stoppable: boolean) {
    this.stoppable = stoppable;
  }

  /** Simulates the user clicking the Viewer's stop button. */
  clickStop() {
    this.stoppable = false;
    this.onDidRequestStop_.fire();
  }

  reveal() { }

  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      this.onDidDispose_.fire();
    }
  }
}

class TestWebview extends QuartoWebview<string> {
  protected getHtml(state: string) {
    return state;
  }
}

let viewTypeCount = 0;

/** Creates a manager whose host hands out fake panels. */
function createManager(createPanel: () => HostWebviewPanel = () => new FakePanel()) {
  const panels: HostWebviewPanel[] = [];
  const host = {
    createPreviewPanel: () => {
      const panel = createPanel();
      panels.push(panel);
      return panel;
    },
  } as unknown as ExtensionHost;
  const context = {
    subscriptions: [],
    extensionUri: vscode.Uri.file("/extension"),
  } as unknown as vscode.ExtensionContext;
  // Each manager registers a panel serializer, so give each a unique view type.
  const manager = new QuartoWebviewManager(
    context,
    host,
    `quarto.test.webviewManager${viewTypeCount++}`,
    "Test",
    TestWebview
  );
  return { manager, panels: panels as FakePanel[] };
}

suite("Webview manager stop button", function () {
  test("shows the stop button on new panels, including recreated ones", function () {
    const { manager, panels } = createManager();

    manager.setStoppable(true);
    manager.showWebview("first");
    panels[0].dispose();
    manager.showWebview("second");

    assert.deepStrictEqual(panels.map((panel) => panel.stoppable), [true, true]);
    manager.dispose();
  });

  test("forwards a stop click from a recreated panel", function () {
    const { manager, panels } = createManager();
    let stopRequests = 0;
    manager.onDidRequestStop(() => stopRequests++);

    manager.setStoppable(true);
    manager.showWebview("first");
    panels[0].dispose();
    manager.showWebview("second");
    panels[1].clickStop();

    assert.strictEqual(stopRequests, 1);
    manager.dispose();
  });

  test("works with panels that have no stop button (VS Code)", function () {
    const { manager, panels } = createManager(() => {
      const panel: HostWebviewPanel = new FakePanel();
      return {
        webview: panel.webview,
        visible: panel.visible,
        reveal: () => panel.reveal(),
        onDidChangeViewState: panel.onDidChangeViewState,
        onDidDispose: panel.onDidDispose,
        dispose: () => panel.dispose(),
      };
    });

    manager.setStoppable(true);
    manager.showWebview("first");
    manager.setStoppable(false);

    assert.strictEqual(panels.length, 1);
    manager.dispose();
  });

  test("closeWebview closes the preview", function () {
    const { manager, panels } = createManager();
    manager.showWebview("first");

    manager.closeWebview();

    assert.deepStrictEqual(
      { disposed: panels[0].disposed, hasWebview: manager.hasWebview() },
      { disposed: true, hasWebview: false }
    );
    manager.dispose();
  });
});
