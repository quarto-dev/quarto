/*
 * client.ts
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

import * as path from "path";
import {
  ExtensionContext,
  Hover,
  SignatureHelp,
  SignatureHelpContext,
  workspace,
  window,
  Range,
  ColorThemeKind,
  ConfigurationTarget,
  MarkdownString,
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
  CompletionList,
  Position,
  TextDocument,
} from "vscode";
import {
  MarkedString,
  Middleware,
  ProvideCompletionItemsSignature,
  ProvideHoverSignature,
  ProvideSignatureHelpSignature,
  State,
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { virtualDoc, virtualDocUri } from "../vdoc/vdoc";
import { activateVirtualDocEmbeddedContent } from "../vdoc/vdoc-content";
import { deactivateVirtualDocTempFiles } from "../vdoc/vdoc-tempfile";
import { imageHover } from "../providers/hover-image";
import { EmbeddedLanguage } from "../vdoc/languages";
import { lspClientTransport } from "core-node";
import { editorMathJsonRpcServer } from "editor-core";

let client: LanguageClient;

export async function activateLsp(
  context: ExtensionContext,
  engine: MarkdownEngine
) {
  // sync color theme config before starting server
  await syncColorThemeConfig();

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("out", "lsp.js")
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
  const middleware: Middleware = {
    provideCompletionItem: embeddedCodeCompletionProvider(engine),
  };
  if (config.get("cells.hoverHelp.enabled", true)) {
    middleware.provideHover = embeddedHoverProvider(engine);
  }
  if (config.get("cells.signatureHelp.enabled", true)) {
    middleware.provideSignatureHelp = embeddedSignatureHelpProvider(engine);
  }

  // create client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "*", language: "quarto" },
      {
        scheme: "*",
        language: "yaml",
        pattern: "**/_{quarto,metadata,extension}*.{yml,yaml}",
      },
    ],
    middleware,
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "quarto-lsp",
    "Quarto LSP",
    serverOptions,
    clientOptions
  );

  // custom method transport
  const lspRequest = lspClientTransport(client);
  const math = editorMathJsonRpcServer(lspRequest);
  client.onDidChangeState(async (e) => {
    if (e.newState === State.Running) {
      try {
        await math.mathjaxTypeset("x + 1", {
          format: "svg",
          theme: "light",
          scale: 1.0,
          extensions: []
        });
      } catch(error) {
        console.log(error);
      }
    }
  });

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  deactivateVirtualDocTempFiles();

  if (!client) {
    return undefined;
  }
  return client.stop();
}

function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
  // initialize embedded conent
  activateVirtualDocEmbeddedContent();

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
      // if there is a trigger character make sure the langauge supports it
      const language = vdoc.language;
      if (context.triggerCharacter) {
        if (
          !language.trigger ||
          !language.trigger.includes(context.triggerCharacter)
        ) {
          return undefined;
        }
      }

      // get uri for completions
      const vdocUri = await virtualDocUri(vdoc, document.uri);

      try {
        const completions = await commands.executeCommand<CompletionList>(
          "vscode.executeCompletionItemProvider",
          vdocUri,
          adjustedPosition(language, position),
          context.triggerCharacter
        );
        return completions.items.map((completion) => {
          if (language.inject && completion.range) {
            if (completion.range instanceof Range) {
              completion.range = unadjustedRange(language, completion.range);
            } else {
              completion.range.inserting = unadjustedRange(
                language,
                completion.range.inserting
              );
              completion.range.replacing = unadjustedRange(
                language,
                completion.range.replacing
              );
            }
          }
          return completion;
        });
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
      // get uri for hover
      const vdocUri = await virtualDocUri(vdoc, document.uri);

      // execute hover
      try {
        const hovers = await commands.executeCommand<Hover[]>(
          "vscode.executeHoverProvider",
          vdocUri,
          adjustedPosition(vdoc.language, position)
        );
        if (hovers && hovers.length > 0) {
          // consolidate content
          const contents = new Array<MarkdownString | MarkedString>();
          hovers.forEach((hover) => {
            hover.contents.forEach((hoverContent) => {
              contents.push(hoverContent);
            });
          });
          // adjust range if required
          const range = hovers[0].range
            ? unadjustedRange(vdoc.language, hovers[0].range)
            : undefined;
          return new Hover(contents, range);
        }
      } catch (error) {
        console.log(error);
      }
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
      const vdocUri = await virtualDocUri(vdoc, document.uri);
      try {
        return await commands.executeCommand<SignatureHelp>(
          "vscode.executeSignatureHelpProvider",
          vdocUri,
          adjustedPosition(vdoc.language, position),
          context.triggerCharacter
        );
      } catch (error) {
        return undefined;
      }
    } else {
      return await next(document, position, context, token);
    }
  };
}

// adjust position for inject
const adjustedPosition = (language: EmbeddedLanguage, pos: Position) => {
  return new Position(pos.line + (language.inject?.length || 0), pos.character);
};
const unadjustedPosition = (language: EmbeddedLanguage, pos: Position) => {
  return new Position(pos.line - (language.inject?.length || 0), pos.character);
};
const unadjustedRange = (language: EmbeddedLanguage, range: Range) => {
  return new Range(
    unadjustedPosition(language, range.start),
    unadjustedPosition(language, range.end)
  );
};

function isWithinYamlComment(doc: TextDocument, pos: Position) {
  const line = doc.lineAt(pos.line).text;
  return !!line.match(/^\s*#\s*\| /);
}

async function syncColorThemeConfig() {
  // update the config
  const updateColorThemeConfig = async () => {
    const theme =
      window.activeColorTheme.kind === ColorThemeKind.Light ? "light" : "dark";
    const quartoConfig = workspace.getConfiguration("quarto");
    await quartoConfig.update(
      "mathjax.theme",
      theme,
      ConfigurationTarget.Global
    );
  };
  await updateColorThemeConfig();

  // listen for changes and update on change
  workspace.onDidChangeConfiguration(async (ev) => {
    if (ev.affectsConfiguration("workbench.colorTheme")) {
      await updateColorThemeConfig();
    }
  });
}
