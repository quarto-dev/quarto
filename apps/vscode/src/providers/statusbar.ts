/*
 * statusbar.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { StatusBarAlignment, window } from "vscode";
import { QuartoContext } from "quarto-core";

export function activateStatusBar(quartoContext: QuartoContext) {
  const statusItem = window.createStatusBarItem(
    "quarto.version",
    StatusBarAlignment.Left
  );
  statusItem.name = "Quarto";
  statusItem.text = `Quarto: ${quartoContext.version}`;
  statusItem.tooltip = `${statusItem.text} (${quartoContext.binPath})`;
  statusItem.show();
}
