/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  commands,
  window,
  workspace,
  Range,
  Position,
  WorkspaceEdit,
} from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import {
  isExecutableLanguageBlock,
  languageNameFromBlock,
  languageBlockAtPosition,
} from "../markdown/language";

export function insertCommands(engine: MarkdownEngine): Command[] {
  return [new InsertCodeCellCommand(engine)];
}

class InsertCodeCellCommand implements Command {
  constructor(private readonly engine_: MarkdownEngine) {}
  private static readonly id = "quarto.insertCodeCell";
  public readonly id = InsertCodeCellCommand.id;

  async execute(): Promise<void> {
    if (window.activeTextEditor) {
      const doc = window.activeTextEditor?.document;
      if (doc && isQuartoDoc(doc)) {
        // determine most recently used language engien above the cursor
        const tokens = await this.engine_.parse(doc);
        const cursorLine = window.activeTextEditor?.selection.active.line;
        let langauge = "";
        let insertTopPaddingLine = false;

        const pos = new Position(cursorLine, 0);
        const block = languageBlockAtPosition(tokens, pos, true);
        if (block?.map) {
          // cursor is in an executable block
          langauge = languageNameFromBlock(block);
          insertTopPaddingLine = true;
          const moveDown = block.map[1] - cursorLine;
          await commands.executeCommand("cursorMove", {
            to: "down",
            value: moveDown,
          });
        } else {
          // cursor is not in an executable block
          for (const executableBlock of tokens.filter(
            isExecutableLanguageBlock
          )) {
            // if this is past the cursor then terminate
            if (executableBlock.map && executableBlock.map[0] > cursorLine) {
              if (!langauge) {
                langauge = languageNameFromBlock(executableBlock);
              }
              break;
            } else {
              langauge = languageNameFromBlock(executableBlock);
            }
          }

          // advance to next blank line if we need to
          const currentLine = doc
            .getText(new Range(cursorLine, 0, cursorLine + 1, 0))
            .trim();
          if (currentLine.length !== 0) {
            insertTopPaddingLine = true;
            await commands.executeCommand("cursorMove", {
              to: "nextBlankLine",
            });
          }
        }

        // finally, if we are on the last line of the buffer or the line before us
        // has content on it then make sure to insert top padding line
        if (cursorLine === window.activeTextEditor.document.lineCount - 1) {
          insertTopPaddingLine = true;
        }
        if (cursorLine > 0) {
          const prevLine = doc
            .getText(new Range(cursorLine - 1, 0, cursorLine, 0))
            .trim();
          if (prevLine.length > 0) {
            insertTopPaddingLine = true;
          }
        }

        // insert the code cell
        const edit = new WorkspaceEdit();
        const kPrefix = "```{";
        edit.insert(
          doc.uri,
          window.activeTextEditor.selection.active,
          (insertTopPaddingLine ? "\n" : "") + kPrefix + langauge + "}\n\n```\n"
        );
        await workspace.applyEdit(edit);
        await commands.executeCommand("cursorMove", {
          to: "up",
          value: langauge ? 2 : 3,
        });
        if (!langauge) {
          await commands.executeCommand("cursorMove", {
            to: "right",
            value: kPrefix.length,
          });
        }
      }
    }
  }
}
