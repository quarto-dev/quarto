/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { biblioRefs } from "../../../core/biblio";

export function biblioCompletions(
  token: string,
  doc: TextDocument
): CompletionItem[] | null {
  const refs = biblioRefs(doc);
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
