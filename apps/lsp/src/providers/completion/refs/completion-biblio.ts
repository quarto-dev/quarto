/*
 * completion-biblio.ts
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

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { biblioRefs } from "editor-server";

import { filePathForDoc } from "../../../core/doc";
import { documentFrontMatter } from "../../../core/markdown";
import { quartoContext } from "../../../quarto/quarto";

export async function biblioCompletions(
  token: string,
  doc: TextDocument
): Promise<CompletionItem[] | null> {
  if (!quartoContext) {
    return null;
  }

  const refs = await biblioRefs(quartoContext, filePathForDoc(doc), documentFrontMatter(doc));
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
