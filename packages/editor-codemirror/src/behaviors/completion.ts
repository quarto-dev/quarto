/*
 * completion.ts
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


import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete"

import { InsertReplaceEdit, TextEdit } from "vscode-languageserver-types";

import { codeViewCompletionContext } from "editor";

import { Behavior, BehaviorContext } from ".";

export function completionBehavior(behaviorContext: BehaviorContext) : Behavior {

  // don't provide behavior if we don't have completions
  if (!behaviorContext.pmContext.ui.completion) {
    return {
      extensions: []
    }
  }

  return {
    extensions: [
      autocompletion({
        override: [
          async (context: CompletionContext) : Promise<CompletionResult | null> => {
            
            // see if there is a completion context
            const cvContext = codeViewCompletionContext(behaviorContext.view.state);
            if (!cvContext) {
              return null;
            }

            // get completions
            const completions = await behaviorContext.pmContext.ui.completion?.codeViewCompletions(cvContext);
            if (!completions || completions.items.length == 0) {
              return null;
            }

            // determine range from first completion
            // TODO: per-completion insert?
            const range = { from: context.pos, to: undefined as unknown as number };
            const first = completions.items[0];
            if (first.textEdit) {
              if (InsertReplaceEdit.is(first.textEdit)) {
                range.from = context.pos - (first.textEdit.insert.end.character - first.textEdit.insert.start.character);
                range.to = context.pos;
              } else if (TextEdit.is(first.textEdit)) {
                range.from = context.pos - (first.textEdit.range.end.character - first.textEdit.range.start.character);
                range.to = context.pos;
              }
            }
            
            return {
              ...range,
              options: completions.items.map(item => ({
                label: item.label,
                detail: item.detail,
                apply: item.insertText
              }))
            };
          }
        ]
      })
    ]
  }
}