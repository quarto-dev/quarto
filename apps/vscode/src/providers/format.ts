/*
 * format.ts
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

import { lines } from "core";
import { commands, Position, Range, TextEdit, window, workspace } from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { languageBlockAtPosition } from "../markdown/language";
import { adjustedPosition, unadjustedRange, virtualDoc, virtualDocUri } from "../vdoc/vdoc";


export function activateCodeFormatting(engine: MarkdownEngine) {


  return [
    new FormatCellCommand(engine),
  ];
}


class FormatCellCommand implements Command {
  public readonly id = "quarto.formatCell";
  constructor(private readonly engine_: MarkdownEngine) {}

  public async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
      const line = editor.selection.start.line;
      const position = new Position(line, 0);
      const block = languageBlockAtPosition(tokens, position, false);
      if (block?.map) {
        const vdoc = await virtualDoc(doc, position, this.engine_);
        if (vdoc) {
          const config = workspace.getConfiguration(undefined, { uri: doc.uri, languageId: vdoc.language.ids[0] });
          const vdocUri = await virtualDocUri(vdoc, doc.uri);
          const edits = await commands.executeCommand<TextEdit[]>(
            "vscode.executeFormatRangeProvider",
            vdocUri,
            editor.selection.isEmpty 
              ? new Range(
                adjustedPosition(vdoc.language, new Position(block.map[0], 0)),
                adjustedPosition(vdoc.language, new Position(block.map[1], Math.max(editor.document.lineAt(block.map[1]).text.length - 1, 0)))
              )
              : new Range(
                adjustedPosition(vdoc.language, editor.selection.start),
                adjustedPosition(vdoc.language, editor.selection.end)
              ),
            {
              tabSize: config.get<number>("editor.tabSize", 4),
              insertSpaces: config.get<boolean>("editor.insertSpaces", true),
            }
          );
          const adjustedEdits = edits.map((edit, index) => {
            let newText = edit.newText;
            if (editor.selection.isEmpty && index === (edits.length - 1)) {
              newText = lines(newText).join("\n") + "\n";
            }
            return new TextEdit(unadjustedRange(vdoc.language, edit.range), newText);
          });

         
          editor.edit(editBuilder => {
            adjustedEdits.forEach(edit => {
              editBuilder.replace(edit.range, edit.newText);
            });
          });
        }
      } else {
        window.showInformationMessage(
          "Editor selection is not within a code cell"
        );
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
  }
}

