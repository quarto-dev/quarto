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
  Selection,
  TextEditor,
} from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { Token, isExecutableLanguageBlock, languageBlockAtPosition, languageNameFromBlock } from "quarto-core";
import { tryAcquirePositronApi } from "@posit-dev/positron";


export function insertCommands(engine: MarkdownEngine): Command[] {
  return [new InsertCodeCellCommand(engine)];
}

class InsertCodeCellCommand implements Command {
  constructor(private readonly engine_: MarkdownEngine) { }
  private static readonly id = "quarto.insertCodeCell";
  public readonly id = InsertCodeCellCommand.id;

  async execute(): Promise<void> {
    if (window.activeTextEditor) {
      const editor = window.activeTextEditor;
      const doc = editor.document;
      if (doc && isQuartoDoc(doc)) {

        // determine most recently used language engien above the cursor
        const tokens = this.engine_.parse(doc);
        const cursorLine = editor.selection.active.line;
        let language = "";
        let insertTopPaddingLine = false;

        const pos = new Position(cursorLine, 0);
        const block = languageBlockAtPosition(tokens, pos, true);
        if (block) {
          // cursor is in an executable block: split it into two cells at the
          // cursor (or three around the selection), like RStudio does
          if (await splitCodeCell(editor, block)) {
            return;
          }
          // block isn't a backtick code fence (e.g. display math), so
          // insert a new cell below it
          language = languageNameFromBlock(block);
          insertTopPaddingLine = true;
          const moveDown = block.range.end.line - cursorLine + 1;
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
            if (executableBlock.range.start.line > cursorLine) {
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

        // if no language found in document, fall back to Positron's active runtime
        const languages = ['python', 'r', 'julia', 'ojs', 'sql', 'bash', 'mermaid', 'dot'];
        if (!language) {
          const session = await tryAcquirePositronApi()?.runtime.getForegroundSession();
          const sessionLang = session?.runtimeMetadata.languageId ?? "";
          if (languages.includes(sessionLang)) {
            language = sessionLang;
          }
        }

        // if we have a known language, use it and put the cursor directly in the
        // code cell, otherwise let the user select the language first
        let header;

        if (language) {
          header = "```{" + language + "}";
        } else {
          header = "```{${1|" + languages.join(",") + "|}}";
        }

        // insert snippet
        await commands.executeCommand("editor.action.insertSnippet", {
          snippet: [
            ...(insertTopPaddingLine ? [""] : []),
            header,
            "${TM_SELECTED_TEXT}$0",
            "```"
          ].join("\n"),
        });
      }
    }
  }
}

// split the code cell containing the cursor into two cells at the cursor line
// (with a selection, into three cells: before / selection / after), mirroring
// RStudio's insert chunk behavior. returns false if the block isn't a backtick
// code fence (e.g. display math) and so can't be split
async function splitCodeCell(editor: TextEditor, block: Token): Promise<boolean> {
  const doc = editor.document;
  const headerLine = block.range.start.line;
  const header = doc.lineAt(headerLine).text;
  const fenceMatch = header.match(/^(`{3,})\s*\{/);
  if (!fenceMatch) {
    return false;
  }
  const fence = fenceMatch[1];

  // locate the closing fence: the parsed range can end one line past it (when
  // the next line has content) or the block may be unclosed at end of document
  const closingFenceRegex = new RegExp("^ {0,3}`{" + fence.length + ",}\\s*$");
  let footerLine = Math.min(block.range.end.line, doc.lineCount - 1);
  while (footerLine > headerLine && !closingFenceRegex.test(doc.lineAt(footerLine).text)) {
    footerLine--;
  }
  const closed = footerLine > headerLine;
  const blockEndLine = closed ? footerLine : Math.min(block.range.end.line, doc.lineCount - 1);
  if (blockEndLine <= headerLine) {
    // header-only block with no body to split
    return false;
  }
  const bodyStart = new Position(headerLine + 1, 0);
  const bodyEnd = closed
    ? new Position(footerLine, 0)
    : new Position(blockEndLine, doc.lineAt(blockEndLine).text.length);

  // determine the split point(s): the cursor line with no selection, otherwise
  // the selection boundaries (clamped to the cell body)
  const clamp = (p: Position) =>
    p.isBefore(bodyStart) ? bodyStart : p.isAfter(bodyEnd) ? bodyEnd : p;
  const selection = editor.selection;
  let splitStart: Position;
  let splitEnd: Position;
  if (selection.isEmpty) {
    splitStart = splitEnd = clamp(new Position(selection.active.line, 0));
  } else {
    splitStart = clamp(selection.start);
    splitEnd = clamp(selection.end);
  }

  // cell bodies, with surrounding blank lines removed (but indentation kept)
  const cellBody = (range: Range) => {
    const text = doc
      .getText(range)
      .replace(/^([ \t]*\n)+/, "")
      .replace(/(\n[ \t]*)+$/, "");
    return text.trim() ? text : "";
  };
  const before = cellBody(new Range(bodyStart, splitStart));
  const middle = cellBody(new Range(splitStart, splitEnd));
  const after = cellBody(new Range(splitEnd, bodyEnd));

  // assemble the new cells and pick the one that should receive the cursor
  const bodies: string[] = [];
  let cursorCell: number;
  if (splitStart.isEqual(splitEnd)) {
    bodies.push(before, after);
    // when everything ends up in the second cell the first (empty) cell is
    // the new one, so put the cursor there
    cursorCell = !before && after ? 0 : 1;
  } else {
    if (before) {
      bodies.push(before);
    }
    cursorCell = bodies.length;
    bodies.push(middle);
    if (after) {
      bodies.push(after);
    }
  }

  // render the cells (empty cells get a blank line for the cursor to land on)
  const cellText = (body: string) => header + "\n" + body + "\n" + fence;
  const newText = bodies.map(cellText).join("\n\n");

  // cursor goes to the first body line of the target cell
  let cursorLine = headerLine + 1;
  for (let i = 0; i < cursorCell; i++) {
    cursorLine += (bodies[i] ? bodies[i].split("\n").length : 1) + 3;
  }

  const replaceRange = new Range(
    new Position(headerLine, 0),
    closed ? new Position(footerLine, doc.lineAt(footerLine).text.length) : bodyEnd
  );
  const applied = await editor.edit((edit) => edit.replace(replaceRange, newText));
  if (applied) {
    const cursor = new Position(cursorLine, 0);
    editor.selection = new Selection(cursor, cursor);
    editor.revealRange(new Range(cursor, cursor));
  }
  return true;
}
