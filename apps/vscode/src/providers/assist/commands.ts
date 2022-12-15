/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Position, Selection, window, commands } from "vscode";
import { Command } from "../../core/command";
import { isQuartoDoc, preserveEditorFocus } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { languageBlockAtPosition } from "../../markdown/language";
import { QuartoAssistViewProvider } from "./webview";

export class PreviewMathCommand implements Command {
  private static readonly id = "quarto.previewMath";
  public readonly id = PreviewMathCommand.id;
  constructor(
    private readonly provider_: QuartoAssistViewProvider,
    private readonly engine_: MarkdownEngine
  ) {}
  async execute(line: number): Promise<void> {
    if (window.activeTextEditor) {
      const doc = window.activeTextEditor.document;
      if (isQuartoDoc(doc)) {
        // if selection isn't currently in the block then move it there
        const tokens = await this.engine_.parse(doc);
        const block = languageBlockAtPosition(
          tokens,
          new Position(line, 0),
          true
        );
        const selection = window.activeTextEditor.selection;
        if (
          block &&
          block.map &&
          (selection.active.line < block.map[0] ||
            selection.active.line >= block.map[1])
        ) {
          const selPos = new Position(line, 0);
          window.activeTextEditor.selection = new Selection(selPos, selPos);
        }

        activateAssistPanel(this.provider_);
      }
    }
  }
}

export class ShowAssistCommand implements Command {
  private static readonly id = "quarto.showAssist";
  public readonly id = ShowAssistCommand.id;
  constructor(private readonly provider_: QuartoAssistViewProvider) {}
  async execute(): Promise<void> {
    activateAssistPanel(this.provider_);
  }
}

function activateAssistPanel(provider: QuartoAssistViewProvider) {
  // attempt to activate (if we fail to the view has been closed so
  // recreate it by calling focus)
  preserveEditorFocus();
  if (!provider.activate()) {
    commands.executeCommand("quarto-assist.focus");
  }
}
