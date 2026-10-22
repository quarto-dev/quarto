/*
 * panel.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { ExtensionContext, window, languages, commands } from "vscode";
import { Command } from "../../core/command";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { quartoLensCodeLensProvider } from "./codelens";
import { PreviewMathCommand, ShowAssistCommand, CodeViewAssistCommand } from "./commands";
import { QuartoAssistViewProvider } from "./webview";

export function activateQuartoAssistPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {

  // indicate that its okay to show
  commands.executeCommand(
    "setContext",
    QuartoAssistViewProvider.enabledContext,
    true
  );

  const provider = new QuartoAssistViewProvider(context);
  context.subscriptions.push(provider);

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      QuartoAssistViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoLensCodeLensProvider(engine)
    )
  );

  context.subscriptions.push(
    commands.registerCommand("quarto.assist.pin", () => {
      provider.pin();
    })
  );

  context.subscriptions.push(
    commands.registerCommand("quarto.assist.unpin", () => {
      provider.unpin();
    })
  );

  return [
    new ShowAssistCommand(provider),
    new CodeViewAssistCommand(provider),
    new PreviewMathCommand(provider, engine),
  ];
}
