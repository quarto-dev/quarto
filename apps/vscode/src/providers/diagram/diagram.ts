/*
 * diagram.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { ExtensionContext, languages } from "vscode";

import { DiagramState } from "editor-types";
import { languageDiagramEngine } from "editor-core";

import { Command } from "../../core/command";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { VisualEditorProvider } from "../editor/editor";
import { diagramCodeLensProvider } from "./codelens";
import { diagramCommands } from "./commands";
import { QuartoDiagramWebviewManager } from "./diagram-webview";
import { ExtensionHost } from "../../host";

export function activateDiagram(
  context: ExtensionContext,
  host: ExtensionHost,
  engine: MarkdownEngine
): Command[] {
  // initiaize manager
  const diagramManager = new QuartoDiagramWebviewManager(context, host, engine);

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

export async function visualEditorDiagramState(): Promise<DiagramState | undefined> {

  const visualEditor = VisualEditorProvider.activeEditor();
  if (visualEditor) {
    const blockContext = await visualEditor.getActiveBlockContext();
    if (blockContext) {
      const engine = languageDiagramEngine(blockContext.activeLanguage);
      if (engine) {
        const activeBlock = blockContext.blocks.find(block => block.active);
        if (activeBlock) {
          return { engine, src: activeBlock.code };
        }
      }
    }
  }

  return undefined;
}
