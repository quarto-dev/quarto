/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, window, languages, commands } from "vscode";
import { Command } from "../../core/command";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { quartoLensCodeLensProvider } from "./codelens";
import { PreviewMathCommand, ShowAssistCommand } from "./commands";
import { QuartoAssistViewProvider } from "./webview";

export function activateQuartoAssistPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  const provider = new QuartoAssistViewProvider(context, engine);
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
    new PreviewMathCommand(provider, engine),
  ];
}
