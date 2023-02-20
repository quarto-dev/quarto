/*
 * insert.ts
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

import {
  commands,
  window,
  Range,
  Position,
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
        let language = "";
        let insertTopPaddingLine = false;

        const pos = new Position(cursorLine, 0);
        const block = languageBlockAtPosition(tokens, pos, true);
        if (block?.map) {
          // cursor is in an executable block
          language = languageNameFromBlock(block);
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
              if (!language) {
                language = languageNameFromBlock(executableBlock);
              }
              break;
            } else {
              language = languageNameFromBlock(executableBlock);
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

        // order by language
        const allLangs = ['python', 'r', 'julia', 'ojs', 'sql', 'bash', 'mermaid', 'dot'];
        const languages = language 
          ? [language, allLangs.filter(lang => lang !== language)]
          : allLangs;
        
        // insert snippet
        await commands.executeCommand("editor.action.insertSnippet", {
          snippet: [
            ...(insertTopPaddingLine ? [""] : []),
            "```{${1|" + languages.join(",") + "|}}",
            "${TM_SELECTED_TEXT}$0",
            "```"
          ].join("\n"),
        });
      }
    }
  }
}
