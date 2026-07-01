/*
 * completion-refs.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Range, Position } from "vscode-languageserver-types";

import { CompletionItem, TextDocuments } from "vscode-languageserver";
import { bypassRefIntelligence } from "../../../util/refs";

import { EditorContext } from "../../../quarto";
import { Quarto } from "../../../../quarto";
import { projectDirForDocument, filePathForDoc, Document, Parser } from "quarto-core";
import { biblioCompletions } from "./completion-biblio";
import { crossrefCompletions } from "./completion-crossref";
import { editorServerDocuments } from "editor-server";

export async function refsCompletions(
  quarto: Quarto,
  parser: Parser,
  doc: Document,
  pos: Position,
  context: EditorContext,
  documents: TextDocuments<Document>,
): Promise<CompletionItem[] | null> {

  // validate trigger
  if (context.trigger && !["@"].includes(context.trigger)) {
    return null;
  }

  if (bypassRefIntelligence(parser, doc, pos, context.line)) {
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
    if (/[^@;[\]\s!,]*/.test(tokenText)) {
      // make sure there is no text directly ahead (except bracket, space, semicolon)
      const nextChar = text.slice(pos.character, pos.character + 1);
      if (!nextChar || [";", " ", "]"].includes(nextChar)) {
        // construct path
        const path = filePathForDoc(doc);
        const projectDir = projectDirForDocument(path);
        const biblioItems = await biblioCompletions(quarto, parser, tokenText, doc);
        const crossrefItems = await crossrefCompletions(
          quarto,
          tokenText,
          path,
          editorServerDocuments(documents),
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
