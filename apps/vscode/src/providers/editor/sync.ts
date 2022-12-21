/*
 * sync.ts
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

import { TextDocument, TextEdit, workspace, WorkspaceEdit } from "vscode";
import { VisualEditor } from "vscode-types";
import { getWholeRange } from "../../core/doc";


export interface EditorSyncManager {
  init: () => Promise<void>;  
  onVisualEditorChanged: (state: unknown, flush: boolean) => Promise<void>;
  onDocumentChanged: () => Promise<void>;
  onDocumentSaving: () => Promise<TextEdit[]>;
}

// sync the document model w/ the visual editor
export function editorSyncManager(
  document: TextDocument, visualEditor: VisualEditor
) : EditorSyncManager {

  // state: an update from the visual editor that we have yet to apply. we don't 
  // apply these on every keystoke b/c they are expensive. we poll to apply these
  // udpates periodically and also apply them immediately on save and when the 
  // visual editor instructs us to do so (e.g. when it loses focus)
  let pendingVisualEdit: unknown | undefined;

  // state: don't propagate the next model change we get to the visual editor
  // (as the change actually resulted from a visual editor sync)
  let supressNextUpdate = false; 

  // collect a pending edit, converting it to markdown and setting the suppressNextUpdate bit
  const collectPendingVisualEdit = async () : Promise<string | undefined> => {
    if (pendingVisualEdit) {
      supressNextUpdate = true;
      const state = pendingVisualEdit;
      pendingVisualEdit = undefined;
      return visualEditor.getMarkdownFromState(state);
    } else {
      return undefined;
    }
  };

  // collect and apply any pending edit by updating the document
  const collectAndApplyPendingVisualEdit = async () => {
    const markdown = await collectPendingVisualEdit();
    if (markdown) {
      await updateDocument(document, markdown);
    }
  };

  // periodically collect and apply pending edits. note that we also
  // collect and apply when the visual editor tells us to (e.g. losing focus)
  // and when a save occurs
  setInterval(collectAndApplyPendingVisualEdit, 1500);


  return {

    // initialize the connection tot he visual editor by providing it
    // with its initial contents and syncing the canonnical markdown
    // back to the document
    init: async() => {
      const markdown = await visualEditor.init(document.getText());
      await updateDocument(document, markdown);
    },

    // notification that the visual editor changed. enque the change
    // for future application (unless we've been told to flush)
    onVisualEditorChanged: async (state: unknown, flush: boolean) => {
      pendingVisualEdit = state;
      if (flush) {
        await collectAndApplyPendingVisualEdit();
      }
    },

    // notification that the document changed, let the visual editor
    // know about the change unless the next update is supressed. note that
    // the visual editor will throttle these changes internally (and
    // apply them immediately when it receives focus)
    onDocumentChanged: async () => {
      if (supressNextUpdate) {
        supressNextUpdate = false;
      } else {
        await visualEditor.applyTextEdit(document.getText());
      }
    },

    // notification that we are saving (allow flusing of visual editor changes)
    onDocumentSaving: async () : Promise<TextEdit[]> => {
      const markdown = await collectPendingVisualEdit();
      if (markdown) {
        return [TextEdit.replace(getWholeRange(document), markdown)];
      } else {
        return [];
      }
    }
  };
}

 
async function updateDocument(document: TextDocument, markdown: string) {
  const wholeDocRange = getWholeRange(document);
  const edit = new WorkspaceEdit();
  edit.replace(document.uri, wholeDocRange, markdown);
  await workspace.applyEdit(edit);
};