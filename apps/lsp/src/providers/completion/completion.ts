/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import {
  CompletionContext,
  CompletionItem,
  CompletionTriggerKind,
  ServerCapabilities,
} from "vscode-languageserver/node";
import { editorContext } from "../../quarto/quarto";
import { attrCompletions } from "./completion-attrs";
import { latexCompletions } from "./completion-latex";
import { yamlCompletions } from "./completion-yaml";
import { refsCompletions } from "./refs/completion-refs";

export const kCompletionCapabilities: ServerCapabilities = {
  completionProvider: {
    resolveProvider: false,
    // register a superset of all trigger characters for embedded languages
    // (languages are responsible for declaring which one they support if any)
    triggerCharacters: [".", "$", "@", ":", "\\", "="],
  },
};

export async function onCompletion(
  doc: TextDocument,
  pos: Position,
  completionContext?: CompletionContext
): Promise<CompletionItem[] | null> {
  const explicit =
    completionContext?.triggerKind === CompletionTriggerKind.TriggerCharacter;
  const trigger = completionContext?.triggerCharacter;
  const context = editorContext(doc, pos, explicit, trigger);
  return (
    (await refsCompletions(doc, pos, context, completionContext)) ||
    (await attrCompletions(context)) ||
    (await latexCompletions(doc, pos, completionContext)) ||
    (await yamlCompletions(context)) ||
    null
  );
}
