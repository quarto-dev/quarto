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
            if (!completions) {
              return null;
            }

            // map completions to codemirror api
            
            // TODO
            return null;
          }
        ]
      })
    ]
  }
}