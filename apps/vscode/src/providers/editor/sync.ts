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

import { TextDocument, TextEdit, workspace, WorkspaceEdit, Range } from "vscode";
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

  // collect a pending edit, converting it to markdown and setting the supressNextUpdate bit
  // if we fail get the markdown then we neither clear the pending edit nor supress the update
  const collectPendingVisualEdit = async () : Promise<string | undefined> => {
    if (pendingVisualEdit) {
      const state = pendingVisualEdit;
      try {
        pendingVisualEdit = undefined;
        const markdown = await visualEditor.getMarkdownFromState(state);
        supressNextUpdate = true;
        return markdown;
      } catch (error) {
        if (pendingVisualEdit === undefined) {
          pendingVisualEdit = state;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.log("Error getting visual editor markdown: " + message);
        return undefined;
      }
    } else {
      return undefined;
    }
  };

  // collect and apply any pending edit by updating the document
  const collectAndApplyPendingVisualEdit = async () => {
    const markdown = await collectPendingVisualEdit();
    if (markdown) {
      await updateWorkspaceDocument(document, markdown);
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
      await updateWorkspaceDocument(document, markdown);
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
      
      // if on onWillSaveTextDocument handler takes too long (> 1.5 sec) 
      // then VS Code will ignore it or stop calling it altogether. In that 
      // case we need a failsafe save to occur ~ 5 seconds after the save
      // (as we have no way of knowing whether VS Code has ignored us)
      setTimeout(async () => {
        const markdown = await visualEditor.getMarkdown();
        if (markdown !== document.getText()) {
          updateWorkspaceDocument(document, markdown);
        }
      }, 5000);

      // attempt to collect pending edit
      const markdown = await collectPendingVisualEdit();
      if (markdown) {
        const edits: TextEdit[] = [];
        const editor = documentEditor(edits);
        updateDocument(editor, document, markdown);
        return edits;
      } else {
        return [];
      }
    }
  };
}




interface DocumentEditor {
  replace: (range: Range, newText: string) => void;
}

function updateDocument(editor: DocumentEditor, document: TextDocument, markdown: string) {
  const wholeDocRange = getWholeRange(document);
  editor.replace(wholeDocRange, markdown);
}

function documentEditor(edits: TextEdit[]) {
  return {
    replace: (range: Range, text: string) => edits.push(TextEdit.replace(range, text))
  };
}

function workspaceDocumentEditor(edit: WorkspaceEdit, document: TextDocument) {
  return {
    replace: (range: Range, text: string) => edit.replace(document.uri, range, text)
  };
}

async function updateWorkspaceDocument(document: TextDocument, markdown: string) {
  const edit = new WorkspaceEdit();
  const editor = workspaceDocumentEditor(edit, document);
  updateDocument(editor, document, markdown);
  await workspace.applyEdit(edit);
};

