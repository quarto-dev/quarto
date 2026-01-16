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
  Diagnostic,
  window,
  ColorThemeKind
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
  State,
  HandleDiagnosticsSignature
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import {
  adjustedPosition,
  unadjustedRange,
  virtualDoc,
  withVirtualDocUri,
} from "../vdoc/vdoc";
import { isVirtualDoc } from "../vdoc/vdoc-tempfile";
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

let client: LanguageClient;

export async function activateLsp(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine,
  outputChannel: LogOutputChannel
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
    handleDiagnostics: createDiagnosticFilter(),
    provideCompletionItem: embeddedCodeCompletionProvider(engine),
    provideDefinition: embeddedGoToDefinitionProvider(engine),
    provideDocumentFormattingEdits: embeddedDocumentFormattingProvider(engine),
    provideDocumentRangeFormattingEdits: embeddedDocumentRangeFormattingProvider(
      engine
    ),
    provideDocumentSemanticTokens: embeddedSemanticTokensProvider(engine),
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

/**
 * Creates a diagnostic handler middleware that filters out diagnostics from virtual documents
 *
 * @returns A handler function for the middleware
 */
export function createDiagnosticFilter() {
  return (uri: Uri, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature) => {
    // If this is not a virtual document, pass through all diagnostics
    if (!isVirtualDoc(uri)) {
      next(uri, diagnostics);
      return;
    }

    // For virtual documents, filter out all diagnostics
    next(uri, []);
  };
}
