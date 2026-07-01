/*
 * completion-crossref.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver";

import { XRef } from "editor-types";

import { EditorServerDocuments, xrefsForFile } from "editor-server";
import { Quarto } from "../../../../quarto";

export async function crossrefCompletions(
  quarto: Quarto,
  token: string,
  filePath: string,
  documents: EditorServerDocuments,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  const xrefs = await xrefsForFile(quarto, filePath, documents, projectDir);
  return xrefs
    .map(xrefCompletion(!!projectDir))
    .filter((ref) => ref.label.startsWith(token));
}

function xrefCompletion(includeFilename: boolean) {
  return (xref: XRef): CompletionItem => ({
    kind: CompletionItemKind.Function,
    label: `${xref.type}-${xref.id}${xref.suffix || ""}`,
    documentation: xref.title
      ? {
        kind: MarkupKind.Markdown,
        value:
          xref.title + (includeFilename ? " — _" + xref.file + "_" : ""),
      }
      : undefined,
  });
}
