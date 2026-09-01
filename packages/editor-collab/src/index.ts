/*
 * index.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 */


import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { ExtensionFn} from "editor";

import { AutomergeController, automergeController } from "./automerge";


export interface CollabConnection {
  onChanged(fn: (connected: boolean) => void) : void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function collabExtension(connection: CollabConnection)
: ExtensionFn {

  return () => {
   
    let automerge: AutomergeController | undefined;
    
    return {

      view(view: EditorView) {
        automergeController(view, connection).then(result => {
          automerge = result
        })
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
