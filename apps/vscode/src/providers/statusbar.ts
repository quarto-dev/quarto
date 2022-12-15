/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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
