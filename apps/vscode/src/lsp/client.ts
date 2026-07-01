/*
 * client.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
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
import { extensionHost } from "../host";
import semver from "semver";
import { EmbeddedLanguage } from "../vdoc/languages";
import { SymbolInformation } from "vscode";

let client: LanguageClient;

export async function activateLsp(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine,
  outputChannel: LogOutputChannel,
) {

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

  const clientOptions: LanguageClientOptions = {
    initializationOptions,
    documentSelector: [
      { scheme: "*", language: "quarto" },
      {
        scheme: "*",
        language: "yaml",
        pattern: documentSelectorPattern,
      },
    ],
    middleware,
    outputChannel
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "quarto-lsp",
    "Quarto LSP",
    serverOptions,
    clientOptions
  );

  // Helper to send current theme to LSP server
  const sendThemeNotification = () => {
    if (client) {
      const kind = (window.activeColorTheme.kind === ColorThemeKind.Light || window.activeColorTheme.kind === ColorThemeKind.HighContrastLight) ? "light" : "dark";
      client.sendNotification("quarto/didChangeActiveColorTheme", { kind });
    }
  };

  // Listen for theme changes and notify the server
  context.subscriptions.push(
    window.onDidChangeActiveColorTheme(() => {
      sendThemeNotification();
    })
  );

  // return once the server is running
  return new Promise<LanguageClient>((resolve, reject) => {

    const handler = client.onDidChangeState(e => {
      if (e.newState === State.Running) {
        handler.dispose();
        // Send computed theme on startup
        sendThemeNotification();
        resolve(client);
      } else if (e.newState === State.Stopped) {
        reject(new Error("Failed to start Quarto LSP Server"));
      }
    });

    // Start the client. This will also launch the server
    client.start();
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
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
