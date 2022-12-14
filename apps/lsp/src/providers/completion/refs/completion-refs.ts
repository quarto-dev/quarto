/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Range, Position } from "vscode-languageserver-types";

import { CompletionContext, CompletionItem } from "vscode-languageserver/node";
import { filePathForDoc } from "../../../core/doc";
import { bypassRefIntelligence } from "../../../core/refs";

import { EditorContext, quarto } from "../../../quarto/quarto";
import { projectDirForDocument } from "../../../shared/metadata";
import { biblioCompletions } from "./completion-biblio";
import { crossrefCompletions } from "./completion-crossref";

export async function refsCompletions(
  doc: TextDocument,
  pos: Position,
  context: EditorContext,
  _completionContext?: CompletionContext
): Promise<CompletionItem[] | null> {
  // bail if no quarto connection
  if (!quarto) {
    return null;
  }

  // validate trigger
  if (context.trigger && !["@"].includes(context.trigger)) {
    return null;
  }

  if (bypassRefIntelligence(doc, pos, context.line)) {
    return null;
  }

  // scan back from the cursor to see if there is a @
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  const text = line.slice(0, pos.character);
  const atPos = text.lastIndexOf("@");
  const spacePos = text.lastIndexOf(" ");

  if (atPos !== -1 && atPos > spacePos) {
    // everything between the @ and the cursor must match the cite pattern
    const tokenText = text.slice(atPos + 1, pos.character);
    if (/[^@;\[\]\s\!\,]*/.test(tokenText)) {
      // make sure there is no text directly ahead (except bracket, space, semicolon)
      const nextChar = text.slice(pos.character, pos.character + 1);
      if (!nextChar || [";", " ", "]"].includes(nextChar)) {
        // construct path
        const path = filePathForDoc(doc);
        const projectDir = projectDirForDocument(path);
        const biblioItems = biblioCompletions(tokenText, doc);
        const crossrefItems = await crossrefCompletions(
          tokenText,
          doc.getText(),
          path,
          projectDir
        );
        if (biblioItems || crossrefItems) {
          return (biblioItems || []).concat(crossrefItems || []);
        } else {
          return null;
        }
      }
    }
  }

  return null;
}
