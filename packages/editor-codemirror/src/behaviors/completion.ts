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
import { executableCodeForActiveLanguage } from "editor";

import { Behavior, BehaviorContext } from ".";

export function completionBehavior(behaviorContext: BehaviorContext) : Behavior {

  

  return {
    extensions: [
      autocompletion({
        override: [
          async (context: CompletionContext) : Promise<CompletionResult | null> => {
            console.log(executableCodeForActiveLanguage(behaviorContext.view.state));
            const word = context.matchBefore(/\w*/)!;
            if (word.from == word.to && !context.explicit)
              return null
            return {
              from: word.from,
              options: [
                {label: "match", type: "keyword"},
                {label: "hello", type: "variable", info: "(World)"},
                {label: "magic", type: "text", apply: "⠁⭒*.✩.*⭒⠁", detail: "macro"}
              ]
            }
          }
        ]
      })
    ]
  }
}
