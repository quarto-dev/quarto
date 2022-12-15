/*
 * commands.ts
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

import { commands, Position, window, Selection } from "vscode";
import { Command } from "../../core/command";
import { isGraphvizDoc, isMermaidDoc, isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isDiagram,
  isDisplayMath,
  languageBlockAtPosition,
} from "../../markdown/language";
import { QuartoDiagramWebviewManager } from "./diagram-webview";

export function diagramCommands(
  manager: QuartoDiagramWebviewManager,
  engine: MarkdownEngine
): Command[] {
  return [
    new PreviewDiagramCommand(manager),
    new PreviewShortcutCommand(engine),
  ];
}

class PreviewDiagramCommand implements Command {
  constructor(private readonly manager_: QuartoDiagramWebviewManager) {}
  execute(line?: number): void {
    // set selection to line
    if (line && window.activeTextEditor) {
      const selPos = new Position(line, 0);
      window.activeTextEditor.selection = new Selection(selPos, selPos);
    }

    // ensure diagram view is visible
    this.manager_.showDiagram();
  }

  private static readonly id = "quarto.previewDiagram";
  public readonly id = PreviewDiagramCommand.id;
}

class PreviewShortcutCommand implements Command {
  constructor(private readonly engine_: MarkdownEngine) {}
  async execute(): Promise<void> {
    // first determine whether this is an alias for preview math or preview diagram
    if (window.activeTextEditor) {
      const doc = window.activeTextEditor.document;
      if (isQuartoDoc(doc)) {
        // are we in a language block?
        const tokens = await this.engine_.parse(doc);
        const line = window.activeTextEditor.selection.start.line;
        const block = languageBlockAtPosition(tokens, new Position(line, 0));
        if (block) {
          if (isDisplayMath(block)) {
            commands.executeCommand("quarto.previewMath", line);
            return;
          } else if (isDiagram(block)) {
            commands.executeCommand("quarto.previewDiagram", line);
            return;
          }
        }
      } else if (isMermaidDoc(doc) || isGraphvizDoc(doc)) {
        commands.executeCommand("quarto.previewDiagram");
        return;
      }
    }
    // info message
    window.showInformationMessage(
      "No preview available (selection not within an equation or diagram)"
    );
  }

  private static readonly id = "quarto.previewShortcut";
  public readonly id = PreviewShortcutCommand.id;
}
