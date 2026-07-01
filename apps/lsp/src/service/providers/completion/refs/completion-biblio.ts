/*
 * completion-biblio.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver";
import { cslRefs } from "editor-server";

import { Document, Parser, filePathForDoc, documentFrontMatter } from "quarto-core";
import { Quarto } from "../../../../quarto";

export async function biblioCompletions(
  quarto: Quarto,
  parser: Parser,
  token: string,
  doc: Document
): Promise<CompletionItem[] | null> {
  const refs = cslRefs(quarto, filePathForDoc(doc), documentFrontMatter(parser, doc));
  if (refs) {
    return refs
      .filter((ref) => ref.id.startsWith(token))
      .map((ref) => ({
        kind: CompletionItemKind.Constant,
        label: ref.id,
        documentation: ref.cite
          ? {
            kind: MarkupKind.Markdown,
            value: ref.cite,
          }
          : undefined,
      }));
  } else {
    return null;
  }
}
