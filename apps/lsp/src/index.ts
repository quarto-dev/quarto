/*
 * index.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import path from "path";

import {
  ClientCapabilities,
  Definition,
  Disposable,
  DocumentLink,
  DocumentSymbol,
  DocumentSymbolRequest,
  FoldingRange,
  InitializeParams,
  ProposedFeatures,
  SelectionRange,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceSymbol
} from "vscode-languageserver";

import { CompletionItem, Hover, Location } from "vscode-languageserver-types";

import { createConnection } from "vscode-languageserver/node";

import { URI } from "vscode-uri";
import { TextDocument } from "vscode-languageserver-textdocument";

import { registerCustomMethods } from "./custom";
import { isWindows, LspConnection } from "core-node";
import { initQuartoContext, Document, markdownitParser, LspInitializationOptions } from "quarto-core";
import { ConfigurationManager, lsConfiguration } from "./config";
import { Logger } from "./logging";
import { languageServiceWorkspace } from "./workspace";
import { middlewareCapabilities, middlewareRegister } from "./middleware";
import { createLanguageService, IMdLanguageService } from "./service";
import { initializeQuarto } from "./quarto";
import { registerDiagnostics } from "./diagnostics";




// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Initialize logger
const logger = new Logger(console.log.bind(console));

// Create text document manager
const documents: TextDocuments<Document> = new TextDocuments(TextDocument);
documents.listen(connection);

// Configuration
const configManager = new ConfigurationManager(connection, logger);
const config = lsConfiguration(configManager);

// Capabilities
let capabilities: ClientCapabilities | undefined;

// Initialization options
let initializationOptions: LspInitializationOptions | undefined;

// Markdown language service
let mdLs: IMdLanguageService | undefined;

// Resolved once `mdLs` has been created in `onInitialized`. Request handlers
// that depend on `mdLs` should `await` this so that requests arriving during
// the async portion of startup do not race and return empty results that the
// client then caches (e.g. an empty document outline after a window reload).
let resolveMdLsReady!: () => void;
const mdLsReady = new Promise<void>(resolve => { resolveMdLsReady = resolve; });

connection.onInitialize((params: InitializeParams) => {
  // Set log level from initialization options if provided so that we use the
  // expected level as soon as possible
  const initLogLevel = Logger.parseLogLevel(
    params.initializationOptions?.logLevel ?? "warn"
  );
  logger.init(initLogLevel);
  configManager.init(initLogLevel);

  // We're connected, log messages via LSP
  logger.setConnection(connection);
  logger.logRequest('initialize');

  // alias options and capabilities
  initializationOptions = params.initializationOptions;
  capabilities = params.capabilities;

  connection.onCompletion(async (params, token): Promise<CompletionItem[]> => {
    logger.logRequest('completion');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    return mdLs?.getCompletionItems(document, params.position, params.context, config, token) || [];
  });

  connection.onHover(async (params, token): Promise<Hover | null | undefined> => {
    logger.logRequest('hover');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }
    return mdLs?.getHover(document, params.position, config, token);
  });


  connection.onDocumentLinks(async (params, token): Promise<DocumentLink[]> => {
    logger.logRequest('documentLinks');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getDocumentLinks(document, token) || [];
  });

  connection.onDocumentLinkResolve(async (link, token): Promise<DocumentLink | undefined> => {
    logger.logRequest('documentLinksResolve');
    return mdLs?.resolveDocumentLink(link, token);
  });

  connection.onDocumentSymbol(async (params, token): Promise<DocumentSymbol[]> => {
    logger.logRequest('documentSymbol');

    await mdLsReady;
    if (token.isCancellationRequested) {
      return [];
    }

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getDocumentSymbols(document, { includeLinkDefinitions: true }, token) || [];
  });

  connection.onFoldingRanges(async (params, token): Promise<FoldingRange[]> => {
    logger.logRequest('foldingRanges');

    await mdLsReady;
    if (token.isCancellationRequested) {
      return [];
    }

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getFoldingRanges(document, token) || [];
  });

  connection.onSelectionRanges(async (params, token): Promise<SelectionRange[] | undefined> => {
    logger.logRequest('selectionRanges');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getSelectionRanges(document, params.positions, token);
  });

  connection.onWorkspaceSymbol(async (params, token): Promise<WorkspaceSymbol[]> => {
    logger.logRequest('workspaceSymbol');
    return mdLs?.getWorkspaceSymbols(params.query, token) || [];
  });

  connection.onReferences(async (params, token): Promise<Location[]> => {
    logger.logRequest('references');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    return mdLs?.getReferences(document, params.position, params.context, token) || [];
  });

  connection.onDefinition(async (params, token): Promise<Definition | undefined> => {
    logger.logRequest('definition');

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return undefined;
    }
    return mdLs?.getDefinition(document, params.position, token);
  });

  // register no-op methods to enable client middleware
  middlewareRegister(connection);

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
      definitionProvider: true,
      documentLinkProvider: { resolveProvider: true },
      foldingRangeProvider: true,
      referencesProvider: true,
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

// listen for color theme changes from the client
connection.onNotification("quarto/didChangeActiveColorTheme", (params: { kind: 'light' | 'dark'; }) => {
  configManager.setComputedThemeKind(params.kind);
});
// further config dependent initialization
connection.onInitialized(async () => {
  logger.logNotification('initialized');

  // sync config if possible
  if (capabilities?.workspace?.configuration) {
    await configManager.subscribe();
    logger.setConfigurationManager(configManager);
  }


  // initialize connection to quarto
  const workspaceFolders = await connection.workspace.getWorkspaceFolders();
  const workspaceDir = workspaceFolders?.length
    ? URI.parse(workspaceFolders[0].uri).fsPath
    : undefined;

  // if we were passed a quarto bin path then use that
  let quartoBinPath: string | undefined;
  if (initializationOptions?.quartoBinPath) {
    quartoBinPath = path.join(initializationOptions?.quartoBinPath, isWindows() ? "quarto.exe" : "quarto");
  }

  // initialize quarto
  const quartoContext = initQuartoContext(
    quartoBinPath || configManager.getSettings().quarto.path,
    workspaceDir
  );
  const quarto = await initializeQuarto(quartoContext);

  // initialize workspace
  const workspace = languageServiceWorkspace(
    workspaceFolders?.map(value => URI.parse(value.uri)) || [],
    documents,
    connection,
    capabilities!,
    config,
    logger
  );

  // initialize parser
  const parser = markdownitParser();

  // create language service
  // note that `mdLs` is referenced in `connection.onInitialize` above
  mdLs = createLanguageService({
    config,
    quarto,
    workspace,
    documents,
    parser,
    logger
  });

  // dynamic diagnostics registration
  registerDiagnostics(
    connection,
    workspace,
    documents,
    mdLs,
    configManager,
    logger
  );

  // create lsp connection (jsonrpc bridge)
  const lspConnection: LspConnection = {
    onRequest(method: string, handler: (params: unknown[]) => Promise<unknown>) {
      return connection.onRequest(method, handler);
    }
  };

  // register custom methods
  registerCustomMethods(quarto, lspConnection, documents);

  // dynamically register the document symbol provider now that `mdLs` exists
  // so the client only learns about the capability once we can actually serve
  // it (avoids the cold-start race where the client requests symbols, caches
  // an empty response, and never re-queries on its own). Re-register on every
  // config change so the client re-queries symbols with the new shape; the
  // VS Code extension restores outline expansion state after the re-query.
  let documentSymbolRegistration: Disposable | undefined;
  const registerDocumentSymbolProvider = async () => {
    documentSymbolRegistration?.dispose();
    documentSymbolRegistration = await connection.client.register(
      DocumentSymbolRequest.type,
      { documentSelector: null }
    );
  };
  await registerDocumentSymbolProvider();
  configManager.onDidChangeConfiguration(() => {
    registerDocumentSymbolProvider();
  });

  // signal that `mdLs` is now ready to serve requests:
  // handlers like document symbols, folding ranges, etc will now proceed
  resolveMdLsReady();
});


// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

// listen
connection.listen();
