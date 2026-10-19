/*
 * positronWebviewPanel.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as vscode from "vscode";
import type * as positron from "positron";

import { PositronWebviewPanel } from "../host/positron";

/** A Positron preview panel from a version without the Viewer stop button. */
function olderPanel(): positron.PreviewPanel {
  return {
    viewType: "quarto.test",
    title: "Test",
    webview: {} as vscode.Webview,
    active: true,
    visible: true,
    onDidChangeViewState: new vscode.EventEmitter<positron.PreviewPanelOnDidChangeViewStateEvent>().event,
    onDidDispose: new vscode.EventEmitter<void>().event,
    reveal: () => { },
    dispose: () => { },
  };
}

suite("Positron webview panel stop button", function () {
  test("sets stoppable and forwards stop clicks when Positron supports them", function () {
    const onDidRequestStop = new vscode.EventEmitter<void>();
    const panel = Object.assign(olderPanel(), {
      stoppable: false,
      onDidRequestStop: onDidRequestStop.event,
    });
    const hostPanel = new PositronWebviewPanel(panel);
    let stopRequests = 0;
    hostPanel.onDidRequestStop?.(() => stopRequests++);

    hostPanel.setStoppable(true);
    onDidRequestStop.fire();

    assert.deepStrictEqual({ stoppable: panel.stoppable, stopRequests }, { stoppable: true, stopRequests: 1 });
  });

  test("does nothing on older Positron without the stop button", function () {
    const panel = olderPanel();
    const hostPanel = new PositronWebviewPanel(panel);

    hostPanel.setStoppable(true);

    assert.deepStrictEqual(
      { hasStoppable: "stoppable" in panel, onDidRequestStop: hostPanel.onDidRequestStop },
      { hasStoppable: false, onDidRequestStop: undefined }
    );
  });
});
