/*
 * completion.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016 James Yu
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

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import {
  CompletionContext,
  CompletionItem,
  CompletionTriggerKind,
  ServerCapabilities,
} from "vscode-languageserver/node";
import { docEditorContext } from "../../quarto/quarto";
import { attrCompletions } from "./completion-attrs";
import { latexCompletions } from "./completion-latex";
import { yamlCompletions } from "./completion-yaml";
import { refsCompletions } from "./refs/completion-refs";
import { ConfigurationManager } from "../../configuration";

export const kCompletionCapabilities: ServerCapabilities = {
  completionProvider: {
    resolveProvider: false,
    // register a superset of all trigger characters for embedded languages
    // (languages are responsible for declaring which one they support if any)
    triggerCharacters: [".", "$", "@", ":", "\\", "="],
  },
};

export function onCompletion(config: ConfigurationManager) {
  
  const latexCompletionHandler = latexCompletions(config);

  return async (
    doc: TextDocument,
    pos: Position,
    completionContext?: CompletionContext
  ): Promise<CompletionItem[] | null> => {
    const explicit =
      completionContext?.triggerKind === CompletionTriggerKind.TriggerCharacter;
    const trigger = completionContext?.triggerCharacter;
    const context = docEditorContext(doc, pos, explicit, trigger);
    return (
      (await refsCompletions(doc, pos, context)) ||
      (await attrCompletions(context)) ||
      (await latexCompletionHandler(doc, pos, completionContext)) ||
      (await yamlCompletions(context, true)) ||
      null
    );
  }
}
