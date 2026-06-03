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
  workspace,
  LogOutputChannel,
  window,
  ColorThemeKind,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import {
  Middleware,
  State,
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { activateVirtualDocEmbeddedContent } from "../vdoc/vdoc-content";

import {
  embeddedDocumentFormattingProvider,
  embeddedDocumentRangeFormattingProvider,
} from "../providers/format";
import { embeddedSemanticTokensProvider } from "../providers/semantic-tokens";
import { LspInitializationOptions, QuartoContext } from "quarto-core";
import { extensionHost } from "../host";
import semver from "semver";

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
    // All code cell language services disabled (completions, hover, signature help, definition, symbols)
    provideDocumentFormattingEdits: embeddedDocumentFormattingProvider(engine),
    provideDocumentRangeFormattingEdits: embeddedDocumentRangeFormattingProvider(
      engine
    ),
    provideDocumentSemanticTokens: embeddedSemanticTokensProvider(engine),
  };
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

