/*
 * index.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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


import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { ExtensionFn} from "editor";

import { AutomergeController, automergeController } from "./automerge";

export function collabExtension()
: ExtensionFn {

  return () => {
   
    let automerge: AutomergeController | undefined;
    
    return {

      view(view: EditorView) {
        automerge = automergeController(view);
      },

      applyTransaction(state: EditorState, tr: Transaction) : EditorState {
        if (automerge?.applyTransaction) {
          return automerge.applyTransaction(state,tr);
        } else {
          return state.apply(tr);
        }
      }
    };
  };
}
