/*
 * server.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import {
  createConnection,
  Diagnostic,
  DidChangeConfigurationNotification,
  InitializeParams,
  ProposedFeatures,
  TextDocumentIdentifier,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";
import { isQuartoDoc, isQuartoYaml } from "./core/doc";
import { config } from "./core/config";
import {
  kCompletionCapabilities,
  onCompletion,
} from "./providers/completion/completion";
import { kHoverCapabilities, onHover } from "./providers/hover/hover";
import { kSignatureCapabilities, onSignatureHelp } from "./providers/signature";
import { provideDiagnostics } from "./providers/diagnostics";

import { initializeQuarto } from "./quarto/quarto";
import { registerCustomMethods } from "./custom";
import { LspConnection } from "core-node";
import { initQuartoContext } from "quarto-core";

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
function resolveDoc(docId: TextDocumentIdentifier) {
  const doc = documents.get(docId.uri);
  if (!doc) {
    return null;
  }
  if (isQuartoDoc(doc) || isQuartoYaml(doc)) {
    return doc;
  } else {
    return null;
  }
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      ...kCompletionCapabilities,
      ...kHoverCapabilities,
      ...kSignatureCapabilities,
    },
  };
});

connection.onInitialized(async () => {

  let workspaceDir: string | undefined;

  if (hasConfigurationCapability) {
    // sync configuration
    const syncConfiguration = async () => {
      const configuration = await connection.workspace.getConfiguration({
        section: "quarto",
      });
      config.update(configuration);
    };
    await syncConfiguration();

    // monitor changes
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
    connection.onDidChangeConfiguration(syncConfiguration);

    // initialize connection to quarto
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    workspaceDir = workspaceFolders?.length
      ? URI.parse(workspaceFolders[0].uri).fsPath
      : undefined;
  }
  // initialize quarto
  const quartoContext = initQuartoContext(config.quartoPath(), workspaceDir);
  initializeQuarto(quartoContext);

  // create lsp connection (jsonrpc bridge) 
  const lspConnection: LspConnection = {
    onRequest(method: string, handler: (params: unknown[]) => Promise<unknown>) {
      return connection.onRequest(method, handler);
    }
  }

  // register custom methods
  registerCustomMethods(quartoContext, lspConnection, documents);

});

connection.onCompletion(async (textDocumentPosition) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    return await onCompletion(
      doc,
      textDocumentPosition.position,
      textDocumentPosition.context
    );
  } else {
    return null;
  }
});

connection.onHover(async (textDocumentPosition) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    if (onHover) {
      return await onHover(doc, textDocumentPosition.position);
    } else {
      return null;
    }
  } else {
    return null;
  }
});

connection.onSignatureHelp(async (textDocumentPosition) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    return await onSignatureHelp();
  } else {
    return null;
  }
});

// diagnostics on open and save (clear on doc modified)
documents.onDidOpen(async (e) => {
  sendDiagnostics(e.document, await provideDiagnostics(e.document));
});
documents.onDidSave(async (e) => {
  sendDiagnostics(e.document, await provideDiagnostics(e.document));
});
documents.onDidChangeContent(async (e) => {
  sendDiagnostics(e.document, []);
});
function sendDiagnostics(doc: TextDocument, diagnostics: Diagnostic[]) {
  connection.sendDiagnostics({
    uri: doc.uri,
    version: doc.version,
    diagnostics,
  });
}

// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

// listen 
documents.listen(connection);
connection.listen();
