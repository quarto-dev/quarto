/*
 * deno-config.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { ExtensionContext, workspace, window, extensions } from "vscode";

import { MarkdownEngine } from "../markdown/engine";
import { TextDocument } from "vscode";
import { isDenoDocument } from "../host/executors";
import { isQuartoDoc } from "../core/doc";

export function activateDenoConfig(context: ExtensionContext, engine: MarkdownEngine) {
  if (extensions.getExtension("denoland.vscode-deno")) {
    const ensureDenoConfig = async (doc: TextDocument) => {
      if (isQuartoDoc(doc)) {
        const config = workspace.getConfiguration(undefined, doc.uri);
        const inspectDenoEnable = config.inspect("deno.enable");
        if (
          !inspectDenoEnable?.globalValue &&
          !inspectDenoEnable?.workspaceValue &&
          !inspectDenoEnable?.workspaceFolderValue
        ) {
          if (isDenoDocument(doc, engine)) {
            await config.update("deno.enable", true, null);
          }

        }
      }
    };
    window.onDidChangeActiveTextEditor((e) => { if (e) { ensureDenoConfig(e?.document); } });
    workspace.onDidOpenTextDocument(ensureDenoConfig, null, context.subscriptions);
    workspace.onDidSaveTextDocument(ensureDenoConfig, null, context.subscriptions);
  }
}
