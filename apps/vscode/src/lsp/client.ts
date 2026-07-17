/*
 * client.ts
 *
 * Copyright (C) 2022-2025 by Posit Software, PBC
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

import * as path from "path";
import {
  ExtensionContext,
  SignatureHelpContext,
  workspace,
  ProviderResult,
  Location,
  LocationLink,
  Definition,
  LogOutputChannel,
  Uri,
  window,
  ColorThemeKind,
  DocumentSymbol,
  Range,
  SymbolKind,
  Disposable,
  languages,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import {
  CancellationToken,
  commands,
  CompletionContext,
  Position,
  TextDocument,
} from "vscode";
import {
  Middleware,
  ProvideCompletionItemsSignature,
  ProvideDefinitionSignature,
  ProvideHoverSignature,
  ProvideSignatureHelpSignature,
  ProvideDocumentSymbolsSignature,
  State,
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import {
  adjustedPosition,
  unadjustedRange,
  virtualDoc,
  withVirtualDocUri,
  VirtualDocStyle,
} from "../vdoc/vdoc";
import { activateVirtualDocEmbeddedContent } from "../vdoc/vdoc-content";
import { vdocCompletions } from "../vdoc/vdoc-completion";

import {
  embeddedDocumentFormattingProvider,
  embeddedDocumentRangeFormattingProvider,
} from "../providers/format";
import { embeddedSemanticTokensProvider } from "../providers/semantic-tokens";
import { getHover, getSignatureHelpHover } from "../core/hover";
import { imageHover } from "../providers/hover-image";
import { LspInitializationOptions, QuartoContext } from "quarto-core";
import { lspClientTransport } from "core-node";
import { JsonRpcRequestTransport } from "core";
import { extensionHost } from "../host";
import semver from "semver";
import { EmbeddedLanguage } from "../vdoc/languages";
import { SymbolInformation } from "vscode";

// The active language client. Retained at module scope so `deactivate` can stop
// it. It is created eagerly during activation but the underlying server process
// is not spawned until the client is actually needed (see `ensureStarted`).
let client: LanguageClient | undefined;

/**
 * Handle returned by {@link activateLsp}. It lets consumers talk to the Quarto
 * language server without forcing it to start at extension activation. The
 * server process (~100MB) is spawned lazily the first time it is actually
 * needed: when a document it serves is opened, or when a request is issued
 * through {@link QuartoLspClient.lspRequest}.
 */
export interface QuartoLspClient {
  /**
   * JSON-RPC transport that lazily starts the language server on first use and
   * waits for it to be running before issuing the request.
   */
  lspRequest: JsonRpcRequestTransport;

  /**
   * Register a callback invoked each time the server reaches the running state.
   * Registering does NOT itself start the server; use this for work that should
   * happen "if and when" the server comes up (e.g. pushing configuration). If
   * the server is already running the callback is invoked immediately.
   */
  onReady: (callback: (client: LanguageClient) => void) => Disposable;

  /**
   * Start the language server if it has not already been started. Idempotent:
   * repeated calls return the same promise.
   */
  ensureStarted: () => Promise<LanguageClient>;

  /**
   * The underlying language client if it is currently running, otherwise
   * undefined. Useful for "fire only if already running" behavior.
   */
  runningClient: () => LanguageClient | undefined;
}

export function activateLsp(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine,
  outputChannel: LogOutputChannel,
): QuartoLspClient {

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("out", "lsp", "lsp.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // create middleware (respect disabling of selected features in config)
  const config = workspace.getConfiguration("quarto");
  activateVirtualDocEmbeddedContent();
  const middleware: Middleware = {
    provideCompletionItem: embeddedCodeCompletionProvider(engine),
    provideDefinition: embeddedGoToDefinitionProvider(engine),
    provideDocumentFormattingEdits: embeddedDocumentFormattingProvider(engine),
    provideDocumentRangeFormattingEdits: embeddedDocumentRangeFormattingProvider(
      engine
    ),
    provideDocumentSemanticTokens: embeddedSemanticTokensProvider(engine),
    provideDocumentSymbols: embeddedDocumentSymbolProvider(engine),
  };
  if (config.get("cells.hoverHelp.enabled", true)) {
    middleware.provideHover = embeddedHoverProvider(engine);
  }
  if (config.get("cells.signatureHelp.enabled", true)) {
    middleware.provideSignatureHelp = embeddedSignatureHelpProvider(engine);
  }
  extensionHost().registerStatementRangeProvider(engine);
  extensionHost().registerHelpTopicProvider(engine);

  // create client options
  const initializationOptions: LspInitializationOptions = {
    quartoBinPath: quartoContext.binPath,
    logLevel: config.get("server.logLevel"),
  };

  const documentSelectorPattern = semver.gte(quartoContext.version, "1.6.24") ?
    "**/_{brand,quarto,metadata,extension}*.{yml,yaml}" :
    "**/_{quarto,metadata,extension}*.{yml,yaml}";

  // documents this server handles; also used to decide when to lazily start it
  const documentSelector = [
    { scheme: "*", language: "quarto" },
    {
      scheme: "*",
      language: "yaml",
      pattern: documentSelectorPattern,
    },
  ];

  const clientOptions: LanguageClientOptions = {
    initializationOptions,
    documentSelector,
    middleware,
    outputChannel
  };

  // Create the language client. NOTE: we deliberately do NOT start it here;
  // startup is deferred until the server is actually needed (see below).
  const languageClient = new LanguageClient(
    "quarto-lsp",
    "Quarto LSP",
    serverOptions,
    clientOptions
  );
  client = languageClient;

  // callbacks to invoke each time the server reaches the running state
  const readyCallbacks = new Set<(client: LanguageClient) => void>();
  const onReady = (callback: (client: LanguageClient) => void): Disposable => {
    readyCallbacks.add(callback);
    // if the server is already running, invoke immediately
    if (languageClient.state === State.Running) {
      callback(languageClient);
    }
    return new Disposable(() => {
      readyCallbacks.delete(callback);
    });
  };

  // Helper to send current theme to LSP server (no-op unless it is running)
  const sendThemeNotification = () => {
    if (languageClient.state === State.Running) {
      const kind = (window.activeColorTheme.kind === ColorThemeKind.Light || window.activeColorTheme.kind === ColorThemeKind.HighContrastLight) ? "light" : "dark";
      languageClient.sendNotification("quarto/didChangeActiveColorTheme", { kind });
    }
  };

  // Send the computed theme whenever the server starts, and on theme changes
  onReady(() => sendThemeNotification());
  context.subscriptions.push(
    window.onDidChangeActiveColorTheme(() => {
      sendThemeNotification();
    })
  );

  // Start the server on first use. Idempotent: the promise is memoized so
  // repeated calls (and multiple triggers) only launch the server once.
  let startPromise: Promise<LanguageClient> | undefined;
  const ensureStarted = (): Promise<LanguageClient> => {
    if (!startPromise) {
      outputChannel.info("Starting Quarto LSP server.");
      startPromise = new Promise<LanguageClient>((resolve, reject) => {
        const handler = languageClient.onDidChangeState(e => {
          if (e.newState === State.Running) {
            handler.dispose();
            // notify readiness listeners (theme, zotero config, ...)
            readyCallbacks.forEach(cb => cb(languageClient));
            resolve(languageClient);
          } else if (e.newState === State.Stopped) {
            handler.dispose();
            reject(new Error("Failed to start Quarto LSP Server"));
          }
        });
        // Start the client. This will also launch the server.
        languageClient.start();
      });
    }
    return startPromise;
  };

  // Lazy JSON-RPC transport: starts the server on first use, then forwards.
  let transport: JsonRpcRequestTransport | undefined;
  const lspRequest: JsonRpcRequestTransport = async (method, params) => {
    const started = await ensureStarted();
    if (!transport) {
      transport = lspClientTransport(started);
    }
    return transport(method, params);
  };

  const runningClient = () =>
    languageClient.state === State.Running ? languageClient : undefined;

  const startLazily = () => {
    void ensureStarted().catch(() => {
      // failure is reported to the output channel by the client itself
    });
  };

  // Lazily start the server when a document it serves is opened. Check the
  // documents already open at activation, then listen for newly opened ones.
  const maybeStartForDocument = (doc: TextDocument) => {
    if (languages.match(documentSelector, doc) > 0) {
      startLazily();
    }
  };
  workspace.textDocuments.forEach(maybeStartForDocument);
  context.subscriptions.push(
    workspace.onDidOpenTextDocument(maybeStartForDocument)
  );

  // Also start the server if the workspace already contains Quarto content, so
  // that workspace-wide features (symbol search, cross-file navigation, project
  // indexing) work before any document is opened. This keeps behavior identical
  // to eager startup for real Quarto projects, while non-Quarto sessions (e.g.
  // editing R files in a workspace with no Quarto files) never spawn the server.
  if (workspace.workspaceFolders?.length) {
    const contentGlobs = ["**/*.{qmd,rmd}", documentSelectorPattern];
    void (async () => {
      for (const glob of contentGlobs) {
        // stop early if some other trigger (e.g. an open document) already started it
        if (startPromise) {
          return;
        }
        const found = await workspace.findFiles(glob, undefined, 1);
        if (found.length > 0) {
          startLazily();
          return;
        }
      }
    })();
  }

  return { lspRequest, onReady, ensureStarted, runningClient };
}

export function deactivate(): Thenable<void> | undefined {
  // Nothing to stop if the server was never started (state stays Stopped until
  // the first `start()` call).
  if (!client || client.state === State.Stopped) {
    return undefined;
  }
  return client.stop();
}

function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
    next: ProvideCompletionItemsSignature
  ) => {
    // see if there is a completion virtual doc we should be using
    const vdoc = await virtualDoc(document, position, engine);

    if (vdoc && !isWithinYamlComment(document, position)) {
      // if there is a trigger character make sure the language supports it
      const language = vdoc.language;
      if (context.triggerCharacter) {
        if (
          !language.trigger ||
          !language.trigger.includes(context.triggerCharacter)
        ) {
          return undefined;
        }
      }

      try {
        return vdocCompletions(
          vdoc,
          position,
          context.triggerCharacter,
          language,
          document.uri
        );
      } catch (error) {
        return undefined;
      }
    } else {
      return await next(document, position, context, token);
    }
  };
}

function embeddedHoverProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    next: ProvideHoverSignature
  ) => {

    // see if we have any local hover providers
    const imgHover = await imageHover(document, position);
    if (imgHover) {
      return imgHover;
    }

    const vdoc = await virtualDoc(document, position, engine);
    if (vdoc) {
      return await withVirtualDocUri(vdoc, document.uri, "hover", async (uri: Uri) => {
        try {
          return await getHover(uri, vdoc.language, position);
        } catch (error) {
          console.log(error);
        }
      });
    }

    // default to server delegation
    return await next(document, position, token);
  };
}

function embeddedSignatureHelpProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    context: SignatureHelpContext,
    token: CancellationToken,
    next: ProvideSignatureHelpSignature
  ) => {
    const vdoc = await virtualDoc(document, position, engine);
    if (vdoc) {
      return await withVirtualDocUri(vdoc, document.uri, "signature", async (uri: Uri) => {
        try {
          return await getSignatureHelpHover(uri, vdoc.language, position, context.triggerCharacter);
        } catch (error) {
          return undefined;
        }
      });
    } else {
      return await next(document, position, context, token);
    }
  };
}

function embeddedGoToDefinitionProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    next: ProvideDefinitionSignature
  ): Promise<Definition | LocationLink[] | null | undefined> => {
    const vdoc = await virtualDoc(document, position, engine);
    if (vdoc) {
      return await withVirtualDocUri(vdoc, document.uri, "definition", async (uri: Uri) => {
        try {
          const definitions = await commands.executeCommand<
            ProviderResult<Definition | LocationLink[]>
          >(
            "vscode.executeDefinitionProvider",
            uri,
            adjustedPosition(vdoc.language, position)
          );
          const resolveLocation = (location: Location) => {
            if (location.uri.toString() === uri.toString()) {
              return new Location(
                document.uri,
                unadjustedRange(vdoc.language, location.range)
              );
            } else {
              return location;
            }
          };
          const resolveLocationLink = (location: LocationLink) => {
            if (location.targetUri.toString() === uri.toString()) {
              const locationLink: LocationLink = {
                targetRange: unadjustedRange(vdoc.language, location.targetRange),
                originSelectionRange: location.originSelectionRange
                  ? unadjustedRange(vdoc.language, location.originSelectionRange)
                  : undefined,
                targetSelectionRange: location.targetSelectionRange
                  ? unadjustedRange(vdoc.language, location.targetSelectionRange)
                  : undefined,
                targetUri: document.uri,
              };
              return locationLink;
            } else {
              return location;
            }
          };
          if (definitions instanceof Location) {
            return resolveLocation(definitions);
          } else if (Array.isArray(definitions) && definitions.length > 0) {
            if (definitions[0] instanceof Location) {
              return definitions.map((definition) =>
                resolveLocation(definition as Location)
              );
            } else {
              return definitions.map((definition) =>
                resolveLocationLink(definition as LocationLink)
              );
            }
          } else {
            return definitions;
          }
        } catch (error) {
          return undefined;
        }
      });
    } else {
      return await next(document, position, token);
    }
  };
}

function isWithinYamlComment(doc: TextDocument, pos: Position) {
  const line = doc.lineAt(pos.line).text;
  return !!line.match(/^\s*#\s*\| /);
}

const isDocumentSymbol = (a: Object): a is DocumentSymbol => {
  return ('range' in a && 'selectionRange' in a);
};

/**
 * Enhances document symbols by adding code symbols from embedded languages to code cells
 */
function embeddedDocumentSymbolProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    token: CancellationToken,
    next: ProvideDocumentSymbolsSignature
  ): Promise<DocumentSymbol[] | SymbolInformation[] | undefined> => {
    // Get base symbols from LSP (headers, code cells, etc.)
    const baseSymbols = await next(document, token);

    if (!baseSymbols || token.isCancellationRequested) {
      return baseSymbols ?? undefined;
    }

    // Check if we got DocumentSymbol[] (can be enhanced) or SymbolInformation[] (cannot)
    // I don't think we actually ever get SymbolInformation[] here, but I'm not certain
    // so this is defensively coded.
    if (baseSymbols.length > 0 && isDocumentSymbol(baseSymbols[0])) {
      const enhanced = await enhanceSymbolsWithCodeCellContent(
        document,
        baseSymbols as DocumentSymbol[],
        engine,
        token
      );

      if (token.isCancellationRequested) return baseSymbols;

      // If any embedded LSP returned undefined, retry once after a brief delay
      if (enhanced !== 'HadUndefined') {
        return enhanced;
      } else {
        await new Promise(r => setTimeout(r, 500));
        if (token.isCancellationRequested) return baseSymbols;
        const retried = await enhanceSymbolsWithCodeCellContent(
          document,
          baseSymbols as DocumentSymbol[],
          engine,
          token
        );
        if (token.isCancellationRequested) return baseSymbols;
        return retried === 'HadUndefined' ? baseSymbols : retried;

      }
    }

    return baseSymbols;
  };
}

/**
 * Finds code cell symbols, makes vdocs for them, gets symbols from the vdoc, and nests those symbols
 * under the code cell's symbol.
 */
async function enhanceSymbolsWithCodeCellContent(
  document: TextDocument,
  symbols: DocumentSymbol[],
  engine: MarkdownEngine,
  token: CancellationToken
): Promise<DocumentSymbol[] | 'HadUndefined'> {
  const enhanced: DocumentSymbol[] = [];
  let hadUndefined = false;

  for (const symbol of symbols) {
    if (token.isCancellationRequested) return symbols;

    // Check if this is a code cell symbol (SymbolKind.Function indicates code cells from toc.ts)
    if (symbol.kind === SymbolKind.Function) {
      const cellSymbols = await getCodeCellSymbols(document, symbol.range, engine);
      if (cellSymbols === undefined) {
        hadUndefined = true;
      }
      symbol.children = [
        ...symbol.children,
        ...(cellSymbols || [])
      ];
    } else {
      const childResult = await enhanceSymbolsWithCodeCellContent(
        document,
        symbol.children,
        engine,
        token
      );
      if (childResult === 'HadUndefined') {
        hadUndefined = true;
        symbol.children = symbol.children; // Keep existing children
      } else {
        symbol.children = childResult;
      }
    }

    enhanced.push(symbol);
  }

  return hadUndefined ? 'HadUndefined' : enhanced;
}

/**
 * Converts SymbolInformation[] to DocumentSymbol[] format
 * SymbolInformation is a flat list, so we convert each to a DocumentSymbol with no children
 */
function symbolInformationToDocumentSymbol(
  symbol: SymbolInformation,
): DocumentSymbol {
  return new DocumentSymbol(
    symbol.name,
    symbol.containerName || '',
    symbol.kind,
    symbol.location.range,
    symbol.location.range
  );
}

/**
 * Gets symbols from an embedded language for a code cell
 */
async function getCodeCellSymbols(
  document: TextDocument,
  cellRange: Range,
  engine: MarkdownEngine
): Promise<DocumentSymbol[] | undefined> {
  try {
    // Get position at the start of the code cell (skip the fence line)
    const position = new Position(cellRange.start.line + 1, 0);

    // Create virtual document for ONLY this code block (not all blocks of the language)
    const vdoc = await virtualDoc(document, position, engine, VirtualDocStyle.Block);
    if (!vdoc) return undefined;

    // Get symbols from the embedded language server
    return await withVirtualDocUri(vdoc, document.uri, "completion", async (uri: Uri) => {
      try {
        const result = await commands.executeCommand<DocumentSymbol[] | SymbolInformation[] | undefined>(
          "vscode.executeDocumentSymbolProvider",
          uri
        );
        if (result === undefined || result.length === 0) return undefined;

        const documentSymbols = isDocumentSymbol(result[0]) ?
          result as DocumentSymbol[] :
          (result as SymbolInformation[]).map<DocumentSymbol>(symbolInformationToDocumentSymbol);

        return unadjustSymbolRanges(documentSymbols, vdoc.language, cellRange.start.line);
      } catch (error) { }
    });
  } catch (error) { }
}

/**
 * Adjusts symbol ranges from virtual document to real document coordinates
 */
function unadjustSymbolRanges(
  symbols: DocumentSymbol[],
  language: EmbeddedLanguage,
  baseLineOffset: number
): DocumentSymbol[] {
  return symbols.map(symbol => {
    return {
      ...symbol,
      range: unadjustedRange(language, symbol.range),
      selectionRange: unadjustedRange(language, symbol.selectionRange),
      children: symbol.children ? unadjustSymbolRanges(symbol.children, language, baseLineOffset) : []
    };
  });
}
