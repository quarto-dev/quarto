/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, languages } from "vscode";
import { Command } from "../../core/command";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { diagramCodeLensProvider } from "./codelens";
import { diagramCommands } from "./commands";
import { QuartoDiagramWebviewManager } from "./diagram-webview";

export function activateDiagram(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  // initiaize manager
  const diagramManager = new QuartoDiagramWebviewManager(context, engine);

  // code lens
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      kQuartoDocSelector,
      diagramCodeLensProvider(engine)
    )
  );

  // diagram commands
  return diagramCommands(diagramManager, engine);
}
