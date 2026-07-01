/*
 * filename.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 */

import semver from "semver";
import * as vscode from "vscode";
import { kQuartoDocSelector } from "../../core/doc";
import { registerDropIntoEditorSupport } from "./drop";

export function activateCopyFiles(context: vscode.ExtensionContext) {
  if (haveDocumentDropEdit()) {
    context.subscriptions.push(
      registerDropIntoEditorSupport(kQuartoDocSelector)
    );
  }
}

function haveDocumentDropEdit() {
  return (
    semver.gte(vscode.version, "1.74.0") &&
    !!(vscode.languages as any).registerDocumentDropEditProvider
  );
}
