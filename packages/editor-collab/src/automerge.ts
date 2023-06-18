/*
 * automerge.ts
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

// TODO: 'after' affinity for marks doesn't seem to work

import { unstable as Automerge } from "@automerge/automerge";

import { EditorState, TextSelection, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { ChangeQueue } from "./changequeue";

import { DocType, kDocContentKey, saveDoc, loadDoc } from "./automerge-doc";

import { 
  applyProsemirrorTransactionToAutomergeDoc, 
  extendProsemirrorTransactionWithAutomergePatch 
} from "./automerge-pm";
import { CollabConnection } from ".";

const kRemoteChangesTransaction = "remoteChanges";

export type Change = Uint8Array;

export interface AutomergeController {
  applyTransaction: (state: EditorState, tr: Transaction) => EditorState;
}

export async function automergeController(
  view: EditorView, 
  connection: CollabConnection
) : Promise<AutomergeController> {
  
  // document we will be editing/merging
  let doc = await loadDoc();

  // initialize view with initial doc contents
  const schema = view.state.schema;
  const tr = view.state.tr;
  tr.replaceSelectionWith(schema.text(doc[kDocContentKey].toString()));
  view.dispatch(tr);

  // channel used to sync clients
  const channel = new BroadcastChannel("editor-collab");

  // queue for throttling channel broadcast (called below in applyTransaction)
  const syncQueue = new ChangeQueue({
    interval: 50,
    handleFlush: (changes: Array<Change>) => {
      channel.postMessage(changes);
    },
  });
  syncQueue.start();

  // function to handle applying changes from a remote source
  const applyRemoteChanges = (changes: Array<Uint8Array>) => {
    
    // apply changes (record patches for subsequent application to prosemirror)
    const patches : Automerge.Patch[] = [];
    doc = Automerge.applyChanges<DocType>(doc, changes, {
      patchCallback: (p) => {
        patches.push(...p)
      }
    })[0];

    // apply patches to prosemirror
    let tr = view.state.tr;
    tr.setMeta(kRemoteChangesTransaction, true);
    for (const patch of patches) {
       const result = extendProsemirrorTransactionWithAutomergePatch(doc, tr, patch)
       const { tr: newTransaction } = result
       tr = newTransaction;
    }
    if (tr.docChanged) {
      view.dispatch(tr);
    }

  }

  // handle disconnect/reconnect
  let connected = true;
  connection.onChanged(async (value) => {
    // update value
    connected = value;

    // on reconnect, get the current doc and apply our local changes to it,
    // then save the doc back to storage
    if (connected) {
      // do a diff both ways
      const remoteDoc = await loadDoc();
      const remoteChanges = Automerge.getChanges(doc, remoteDoc);
      const localChanges = Automerge.getChanges(remoteDoc, doc);

      // apply remote changes to our doc
      applyRemoteChanges(remoteChanges);

      // broadcast local changes to other docs
      syncQueue.enqueue(...localChanges);

      // save resulting doc
      saveDoc(doc);
    }
  });

  // subscribe to changes from channel
  channel.onmessage = ev => {

    // ignore changes when disconnected
    if (!connected) {
      return;
    }

    // get changes
    const remoteChanges = ev.data as Array<Uint8Array>;
   
    // apply changes
    applyRemoteChanges(remoteChanges);

  }

  return {

    applyTransaction: (state: EditorState, tr: Transaction): EditorState => {

      // do default if this was a remote changes transaction or if there
      // we no mutations of the core documents
      if (tr.getMeta(kRemoteChangesTransaction) === true ||
          (!tr.storedMarksSet && !tr.docChanged)) {
        state = state.apply(tr);
        return state;
      }
    
      // round trip the transaction through micromerge
      const result = applyProsemirrorTransactionToAutomergeDoc({ doc, tr });
      const { change, patches } = result
      doc = result.doc;
      if (change) {
        // new transaction
        let transaction = state.tr

        // apply patches
        for (const patch of patches) {
          const { tr: newTxn } = extendProsemirrorTransactionWithAutomergePatch(doc, transaction, patch)
          transaction = newTxn
        }

        // If this transaction updated the local selection, we need to make sure that's 
        // reflected in the editor state (Roundtripping through Automerge won't do that 
        // for us, since selection state is not part of the document state.
        if (tr.selectionSet) {
          transaction.setSelection(
            new TextSelection(
              transaction.doc.resolve(tr.selection.anchor),
              transaction.doc.resolve(tr.selection.head)
            )
          );
        }

        // apply transaction
        state = state.apply(transaction);

        // push changes to other editors
        if (connected) {
          syncQueue.enqueue(change);
          saveDoc(doc);
        }

      } else {
        // no automerge changes to so just preform default handling
        state = state.apply(tr);
      }
 
      // return mutated state
      return state;
    },
  };
}


