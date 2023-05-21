/*
 * index.ts
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

// TODO: implement parser (refactor providers)
// TODO: hookup service:
//   - remove redundant impls on the client
//   - consolidate quarto providers into service
//   - return service capabilities
// TODO: don't return no-op capabilities if we aren't in vscode (middleware)
// TODO: see how _extensions plays in extension projects (check readonly?)
// TODO: investigate whether we should support DidChangeWatchedFilesNotification (multiple?)


import {
  createConnection,
  Diagnostic,
  InitializeParams,
  ProposedFeatures,
  TextDocumentIdentifier,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";
import { isQuartoDoc, isQuartoYaml } from "./core/doc";
import {
  kCompletionCapabilities,
  onCompletion,
} from "./providers/completion/completion";
import { kHoverCapabilities, onHover } from "./providers/hover/hover";
import { kSignatureCapabilities } from "./providers/signature";
import { provideDiagnostics } from "./providers/diagnostics";

import { initializeQuarto } from "./quarto/quarto";
import { registerCustomMethods } from "./custom";
import { LspConnection } from "core-node";
import { initQuartoContext } from "quarto-core";
import { kDefinitionCapabilities } from "./providers/definition";
import { kFormattingCapabilities } from "./providers/format";
import { ConfigurationManager } from "./config";
import { LogFunctionLogger } from "./logging";
import { languageServiceWorkspace } from "./workspace";
import { langaugeServiceMdParser } from "./parser";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// config manager and logging
const configuration = new ConfigurationManager();

connection.onInitialize((params: InitializeParams) => {

  const capabilities = params.capabilities;

  // Create a simple text document manager. The text document manager
  // supports full document sync only
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  documents.listen(connection);

  // resolve a uri from the text document manager
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

  connection.onInitialized(async () => {  

    // sync config if possible
    if (capabilities.workspace?.configuration) {
      await configuration.connect(connection);
    }

    // initialize connection to quarto
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    const workspaceDir = workspaceFolders?.length
      ? URI.parse(workspaceFolders[0].uri).fsPath
      : undefined;
     
    // initialize quarto
    const quartoContext = initQuartoContext(
      configuration.getSettings()?.quarto.path, 
      workspaceDir
    );
    initializeQuarto(quartoContext);

    // initialize logger
    const logger = new LogFunctionLogger(
      console.log.bind(console), 
      configuration
    );

    // initialize workspace
    const workspace = languageServiceWorkspace(
      workspaceFolders?.map(value => URI.parse(value.uri)) || [],
      documents,
      connection,
      configuration,
      logger
    )

    // initialize parser
    const mdParser = langaugeServiceMdParser(quartoContext, "resources");

    

    // initialize language service workspace
    //const workspace = lan

  
    const onCompletionHandler = onCompletion(configuration);
    connection.onCompletion(async (textDocumentPosition) => {
      const doc = resolveDoc(textDocumentPosition.textDocument);
      if (doc) {
        return await onCompletionHandler(
          doc,
          textDocumentPosition.position,
          textDocumentPosition.context
        );
      } else {
        return null;
      }
    });
    
    const onHoverProvider = onHover(configuration);
    connection.onHover(async (textDocumentPosition) => {
      const doc = resolveDoc(textDocumentPosition.textDocument);
      if (doc) {
        return await onHoverProvider(doc, textDocumentPosition.position);
      } else {
        return null;
      }
    });
    
    // methods provided just so we can intercept them w/ middleware on the client
    connection.onSignatureHelp(async () => {
      return null;
    });
    
    connection.onDefinition(async () => {
      return null;
    });
    
    connection.onDocumentFormatting(async () => {
      return null;
    });
    
    connection.onDocumentRangeFormatting(async () => {
      return null;
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

    // create lsp connection (jsonrpc bridge) 
    const lspConnection: LspConnection = {
      onRequest(method: string, handler: (params: unknown[]) => Promise<unknown>) {
        return connection.onRequest(method, handler);
      }
    }

    // register custom methods
    registerCustomMethods(quartoContext, lspConnection, documents);
  
  });
  
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      ...kCompletionCapabilities,
      ...kHoverCapabilities,
      ...kSignatureCapabilities,
      ...kDefinitionCapabilities,
      ...kFormattingCapabilities,
    },
  };
});



// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

// listen 
connection.listen();
