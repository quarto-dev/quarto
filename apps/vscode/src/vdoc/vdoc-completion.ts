/*
 * vdoc-completion.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { commands, Position, Uri, CompletionList, CompletionItem, Range } from "vscode";
import { EmbeddedLanguage } from "./languages";
import { adjustedPosition, unadjustedRange, VirtualDoc, withVirtualDocUri } from "./vdoc";

export async function vdocCompletions(
  vdoc: VirtualDoc,
  position: Position,
  trigger: string | undefined,
  language: EmbeddedLanguage,
  parentUri: Uri
) {
  const completions = await withVirtualDocUri(vdoc, parentUri, "completion", async (uri: Uri) => {
    return await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider",
      uri,
      adjustedPosition(language, position),
      trigger
    );
  });
  return completions.items.map((completion: CompletionItem) => {
    if (language.inject && completion.range) {
      if (completion.range instanceof Range) {
        completion.range = unadjustedRange(language, completion.range);
      } else {
        completion.range.inserting = unadjustedRange(
          language,
          completion.range.inserting
        );
        completion.range.replacing = unadjustedRange(
          language,
          completion.range.replacing
        );
      }
    }
    return completion;
  });

}
