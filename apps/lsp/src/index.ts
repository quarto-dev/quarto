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
// TODO: see how _extensions plays in extension projects (check readonly?)
// TODO: investigate more efficient diagnostics scheme (must return diagnosticsProvider from capabilities)
// (see also registerValidateSupport, PullDiagnosticsManager, etc.)
// TODO: investigate whether we should support DidChangeWatchedFilesNotification (multiple?)
// TODO: can we make quarto a 'service' rather than a global

// TODO: test and tweak all of the features, updating changelog as required

import {
  CancellationToken,
  ClientCapabilities,
  CodeAction,
  Definition,
  Diagnostic,
  DocumentLink,
  DocumentSymbol,
  FoldingRange,
  InitializeParams,
  ProposedFeatures,
  ResponseError,
  SelectionRange,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceSymbol
} from "vscode-languageserver";

import { CompletionItem, Hover, Location } from "vscode-languageserver-types"

import { createConnection } from "vscode-languageserver/node"

import * as l10n from '@vscode/l10n';

import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";

import { initializeQuarto } from "./service/quarto/quarto";
import { registerCustomMethods } from "./custom";
import { LspConnection } from "core-node";
import { initQuartoContext } from "quarto-core";
import { ConfigurationManager, getDiagnosticsOptions, lsConfiguration } from "./config";
import { LogFunctionLogger } from "./logging";
import { languageServiceWorkspace } from "./workspace";
import { langaugeServiceMdParser } from "./parser";
import { middlewareCapabilities, middlewareRegister } from "./middleware";
import { createLanguageService, IMdLanguageService, ITextDocument, RenameNotSupportedAtLocationError } from "./service";

const kOrganizeLinkDefKind = 'source.organizeLinkDefinitions';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create text document manager
const documents: TextDocuments<ITextDocument> = new TextDocuments(TextDocument);
documents.listen(connection);

// Configuration
const configManager = new ConfigurationManager(connection);
const config = lsConfiguration(configManager);

// Capabilities 
let capabilities: ClientCapabilities | undefined;

// Markdowdn language service
let mdLs: IMdLanguageService | undefined;

connection.onInitialize((params: InitializeParams) => {

  // alias capabilities
  capabilities = params.capabilities;

  connection.onCompletion(async (params, token): Promise<CompletionItem[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return mdLs?.getCompletionItems(document, params.position, params.context, config, token) || [];
  })

  connection.onHover(async (params) : Promise<Hover | null | undefined> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }
    return mdLs?.getHover(document, params.position, config);
  })


  connection.onDocumentLinks(async (params, token): Promise<DocumentLink[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getDocumentLinks(document, token) || [];
  });

  connection.onDocumentLinkResolve(async (link, token): Promise<DocumentLink | undefined> => {
    return mdLs?.resolveDocumentLink(link, token);
  });

  connection.onDocumentSymbol(async (params, token): Promise<DocumentSymbol[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getDocumentSymbols(document, { includeLinkDefinitions: true }, token) || [];
  });

  connection.onFoldingRanges(async (params, token): Promise<FoldingRange[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getFoldingRanges(document, token) || [];
  });

  connection.onSelectionRanges(async (params, token): Promise<SelectionRange[] | undefined> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getSelectionRanges(document, params.positions, token);
  });

  connection.onWorkspaceSymbol(async (params, token): Promise<WorkspaceSymbol[]> => {
    return mdLs?.getWorkspaceSymbols(params.query, token) || [];
  });

  connection.onReferences(async (params, token): Promise<Location[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getReferences(document, params.position, params.context, token) || [];
  });

  connection.onDefinition(async (params, token): Promise<Definition | undefined> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return undefined;
    }
    return mdLs?.getDefinition(document, params.position, token);
  });

  connection.onPrepareRename(async (params, token) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return undefined;
    }

    try {
      return await mdLs?.prepareRename(document, params.position, token);
    } catch (e) {
      if (e instanceof RenameNotSupportedAtLocationError) {
        throw new ResponseError(0, e.message);
      } else {
        throw e;
      }
    }
  });

  connection.onRenameRequest(async (params, token) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return undefined;
    }
    return mdLs?.getRenameEdit(document, params.position, params.newName, token);
  });

  interface OrganizeLinkActionData {
    readonly uri: string;
  }

  connection.onCodeAction(async (params, token) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return undefined;
    }

    if (params.context.only?.some(kind => kind === 'source' || kind.startsWith('source.'))) {
      const action: CodeAction = {
        title: l10n.t("Organize link definitions"),
        kind: kOrganizeLinkDefKind,
        data: <OrganizeLinkActionData>{ uri: document.uri }
      };
      return [action];
    }

    return mdLs?.getCodeActions(document, params.range, params.context, token);
  });

  connection.onCodeActionResolve(async (codeAction, token) => {
    if (codeAction.kind === kOrganizeLinkDefKind) {
      const data = codeAction.data as OrganizeLinkActionData;
      const document = documents.get(data.uri);
      if (!document) {
        return codeAction;
      }

      const edits = (await mdLs?.organizeLinkDefinitions(document, { removeUnused: true }, token)) || [];
      codeAction.edit = {
        changes: {
          [data.uri]: edits
        }
      };
      return codeAction;
    }

    return codeAction;
  });
 
  // register no-op methods to enable client middleware
  middlewareRegister(connection);
   
  // diagnostics on open and save (clear on doc modified)
  documents.onDidOpen(async (e) => {
    sendDiagnostics(e.document, await computeDiagnostics(e.document));
  });
  documents.onDidSave(async (e) => {
    sendDiagnostics(e.document, await computeDiagnostics(e.document));
  });
  documents.onDidChangeContent(async (e) => {
    sendDiagnostics(e.document, []);
  });
  async function computeDiagnostics(doc: ITextDocument) : Promise<Diagnostic[]> {
    return mdLs?.computeDiagnostics(doc, getDiagnosticsOptions(configManager), CancellationToken.None) || [];
  }
  function sendDiagnostics(doc: ITextDocument, diagnostics: Diagnostic[]) {
    connection.sendDiagnostics({
      uri: doc.uri,
      version: doc.version,
      diagnostics,
    });
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        // register a superset of all trigger characters for embedded languages
        // (languages are responsible for declaring which one they support if any)
        triggerCharacters: [".", "$", "@", ":", "\\", "=", "/", "#"],
      },
      hoverProvider: true,
      codeActionProvider: {
        resolveProvider: true,
        codeActionKinds: [
          kOrganizeLinkDefKind,
          'quickfix',
          'refactor',
        ]
      },
      definitionProvider: true,
      documentLinkProvider: { resolveProvider: true },
      documentSymbolProvider: true,
      foldingRangeProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true, },
      selectionRangeProvider: true,
      workspaceSymbolProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },
      ...middlewareCapabilities()
    },
  };
});

// further config dependent initialization
connection.onInitialized(async () => {  

  // sync config if possible
  if (capabilities?.workspace?.configuration) {
    configManager.subscribe();
  }

  // initialize connection to quarto
  const workspaceFolders = await connection.workspace.getWorkspaceFolders();
  const workspaceDir = workspaceFolders?.length
    ? URI.parse(workspaceFolders[0].uri).fsPath
    : undefined;
   
  // initialize quarto
  const quartoContext = initQuartoContext(
    configManager.getSettings()?.quarto.path, 
    workspaceDir
  );
  initializeQuarto(quartoContext);

 
  // initialize logger
  const logger = new LogFunctionLogger(
    console.log.bind(console), 
    configManager
  );

  // initialize workspace
  const workspace = languageServiceWorkspace(
    workspaceFolders?.map(value => URI.parse(value.uri)) || [],
    documents,
    connection,
    config,
    logger
  )

  // initialize parser
  const parser = langaugeServiceMdParser(quartoContext, "resources");

  // create language service
  mdLs = createLanguageService({
    config,
    workspace,
    parser, 
    logger
  });

  // create lsp connection (jsonrpc bridge) 
  const lspConnection: LspConnection = {
    onRequest(method: string, handler: (params: unknown[]) => Promise<unknown>) {
      return connection.onRequest(method, handler);
    }
  }

  // register custom methods
  registerCustomMethods(quartoContext, lspConnection, documents);

});


// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

// listen 
connection.listen();
