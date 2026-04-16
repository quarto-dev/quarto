/*
 * main.ts
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

import * as vscode from "vscode";
import * as path from "path";
import { tryAcquirePositronApi } from "@posit-dev/positron";
import { MarkdownEngine } from "./markdown/engine";
import { kQuartoDocSelector } from "./core/doc";
import { activateLsp, deactivate as deactivateLsp } from "./lsp/client";
import { cellCommands } from "./providers/cell/commands";
import { quartoCellExecuteCodeLensProvider } from "./providers/cell/codelens";
import { activateQuartoAssistPanel } from "./providers/assist/panel";
import { activatePreview } from "./providers/preview/preview";
import { activateRender } from "./providers/render";
import { activateStatusBar } from "./providers/statusbar";
import { walkthroughCommands } from "./providers/walkthrough";
import { activateLuaTypes } from "./providers/lua-types";
import { activateCreate } from "./providers/create/create";
import { activateEditor } from "./providers/editor/editor";
import { activateCopyFiles } from "./providers/copyfiles";
import { activateZotero } from "./providers/zotero/zotero";
import { extensionHost } from "./host";
import { isInlineOutputEnabled } from "./host/hooks";
import { initQuartoContext, getSourceDescription } from "quarto-core";
import { configuredQuartoPath } from "./core/quarto";
import { activateDenoConfig } from "./providers/deno-config";
import { textFormattingCommands } from "./providers/text-format";
import { newDocumentCommands } from "./providers/newdoc";
import { insertCommands } from "./providers/insert";
import { activateDiagram } from "./providers/diagram/diagram";
import { activateCodeFormatting } from "./providers/format";
import { activateOptionEnterProvider } from "./providers/option";
import { activateBackgroundHighlighter } from "./providers/background";
import { activateYamlLinks } from "./providers/yaml-links";
import { activateYamlFilepathCompletions } from "./providers/yaml-filepath-completions";
import { activateContextKeySetter } from "./providers/context-keys";
import { CommandManager } from "./core/command";
import { createQuartoExtensionApi, QuartoExtensionApi } from "./api";

/**
 * Entry point for the entire extension! This initializes the LSP, quartoContext, extension host, and more...
 */
export async function activate(context: vscode.ExtensionContext): Promise<QuartoExtensionApi> {
  // create output channel for extension logs and lsp client logs
  const outputChannel = vscode.window.createOutputChannel("Quarto", { log: true });

  outputChannel.info("Activating Quarto extension.");

  // create extension host
  const host = extensionHost();

  // create markdown engine
  const engine = new MarkdownEngine();

  // commands
  const commands = cellCommands(host, engine);

  // get quarto context (some features conditional on it)
  // Create a logger function for verbose discovery output
  const discoveryLogger = (msg: string) => outputChannel.info(msg);

  outputChannel.info("Searching for Quarto CLI...");
  const quartoPathResult = await configuredQuartoPath(discoveryLogger);
  const workspaceFolder = vscode.workspace.workspaceFolders?.length
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;
  const quartoContext = initQuartoContext(
    quartoPathResult?.path,
    workspaceFolder,
    // Look for quarto in the app root; this is where Positron installs it
    [path.join(vscode.env.appRoot, "quarto", "bin")],
    vscode.window.showWarningMessage,
    { logger: discoveryLogger, source: quartoPathResult?.source }
  );

  // Log the final discovery result
  if (quartoContext.available) {
    const sourceDescription = getSourceDescription(quartoContext.source);
    outputChannel.info(`Using Quarto ${quartoContext.version} from ${quartoContext.binPath}${sourceDescription}`);
  } else {
    outputChannel.info("Quarto CLI not found. Some features will be unavailable.");
  }
  if (quartoContext.available) {

    // enable commands conditional on quarto installation
    vscode.commands.executeCommand(
      "setContext",
      "quartoAvailable",
      true
    );

    // ensure quarto is on the path
    context.environmentVariableCollection.prepend(
      "PATH",
      quartoContext.binPath + path.delimiter
    );

    // status bar
    activateStatusBar(quartoContext);

    // lua types
    await activateLuaTypes(context, quartoContext);

    // deno config
    activateDenoConfig(context, engine);

    // lsp
    const lspClient = await activateLsp(context, quartoContext, engine, outputChannel);

    // provide visual editor
    const editorCommands = activateEditor(context, host, quartoContext, lspClient, engine);
    commands.push(...editorCommands);

    // zotero
    const zoteroCommands = await activateZotero(context, lspClient);
    commands.push(...zoteroCommands);

    // assist panel
    const assistCommands = activateQuartoAssistPanel(context, engine);
    commands.push(...assistCommands);
  }
  // walkthough
  commands.push(...walkthroughCommands(host, quartoContext));

  // provide render
  const renderCommands = activateRender(quartoContext, engine);
  commands.push(...renderCommands);

  // provide preview
  const previewCommands = activatePreview(context, host, quartoContext, engine);
  commands.push(...previewCommands);

  // provide create
  const createCommands = await activateCreate(context, quartoContext);
  commands.push(...createCommands);

  commands.push(...textFormattingCommands());

  commands.push(...newDocumentCommands());

  commands.push(...insertCommands(engine));

  commands.push(...activateDiagram(context, host, engine));

  commands.push(...activateCodeFormatting(engine));

  // provide code lens (conditionally in Positron based on inline output setting)
  const isPositron = tryAcquirePositronApi();
  if (isPositron) {
    // In Positron, only show code lens when inline output is disabled
    let codeLensDisposable: vscode.Disposable | undefined;

    const updateCodeLens = () => {
      const inlineOutputEnabled = isInlineOutputEnabled();

      if (inlineOutputEnabled && codeLensDisposable) {
        // Dispose existing code lens when inline output is enabled
        codeLensDisposable.dispose();
        codeLensDisposable = undefined;
      } else if (!inlineOutputEnabled && !codeLensDisposable) {
        // Register code lens when inline output is disabled
        codeLensDisposable = vscode.languages.registerCodeLensProvider(
          kQuartoDocSelector,
          quartoCellExecuteCodeLensProvider(host, engine)
        );
        context.subscriptions.push(codeLensDisposable);
      }
    };

    // Initial setup
    updateCodeLens();

    // Listen for setting changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("positron.quarto.inlineOutput.enabled")) {
          updateCodeLens();
        }
      })
    );
  } else {
    // In VS Code, always register the code lens
    vscode.languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoCellExecuteCodeLensProvider(host, engine)
    );
  }

  // provide file copy/drop handling
  activateCopyFiles(context);

  // option enter handler
  activateOptionEnterProvider(context, engine);

  // background highlighter
  activateBackgroundHighlighter(context, engine);

  // yaml document links
  activateYamlLinks(context);

  // yaml filepath completions
  activateYamlFilepathCompletions(context);

  // context setter
  activateContextKeySetter(context, engine);

  // commands
  const commandManager = new CommandManager();
  for (const cmd of commands) {
    commandManager.register(cmd);
  }
  context.subscriptions.push(commandManager);

  // Register configuration change listener for Quarto path settings
  registerQuartoPathConfigListener(context, outputChannel);

  outputChannel.info("Activated Quarto extension.");

  // Return the public API for other extensions to use
  return createQuartoExtensionApi(quartoContext);
}

/**
 * Register a listener for changes to Quarto path settings that require a restart
 */
function registerQuartoPathConfigListener(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel) {
  // Check if we're in Positron
  const isPositron = tryAcquirePositronApi();

  // List of settings that require restart when changed
  const quartoPathSettings = [
    "quarto.path",
    "quarto.usePipQuarto",
  ];
  const positronPathSettings = [
    "quarto.useBundledQuartoInPositron"
  ];

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      // Check if any of our path settings changed
      const requiresRestart = quartoPathSettings.some(setting => event.affectsConfiguration(setting));
      const requiresPositronRestart = isPositron && positronPathSettings.some(setting => event.affectsConfiguration(setting));

      if (requiresRestart || requiresPositronRestart) {
        outputChannel.info(`Quarto path settings changed, restart required: ${quartoPathSettings.filter(setting =>
          event.affectsConfiguration(setting)).join(", ")}`);

        // Prompt user to restart
        vscode.window.showInformationMessage(
          "Quarto path settings have changed. Please reload the window for changes to take effect.",
          "Reload Window"
        ).then(selection => {
          if (selection === "Reload Window") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
      }
    })
  );
}

export async function deactivate() {
  return deactivateLsp();
}
