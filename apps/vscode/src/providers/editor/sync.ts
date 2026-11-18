/*
 * sync.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { TextDocument, TextEdit, workspace, WorkspaceEdit, Range } from "vscode";
import { JsonRpcRequestTransport } from "core";

import { editorSourceJsonRpcServer } from "editor-core";
import { isXRef, NavLocation, VSCodeVisualEditor, XRef } from "editor-types";

import { getWholeRange } from "../../core/doc";

/* Strategy for managing synchronization of edits between source and visual mode.

This is made more complicated by the fact that getting/setting visual editor markdown
is expensive (requires a pandoc round trip) so is throttled by 1 second. We also need
to guard against edits pinging back and forth (esp. w/ the requirement on flushing all
pending edits on save)

For the visual editor syncing to external changes:

1) Only accept external edits when the visual editor has no edits that the document
   doesn't show yet (otherwise the visual editor's edits win and are written over them)

2) These external edits are throttled by 1 second so we don't get constant (expensive)
   refreshing of the visual editor when users type in the text editor.

For the visual editor propagating its own changes:

1) The visual editor will continuously send the JSON version of the editor AST
   to the host as updates occur (this is very cheap and doesn't involve pandoc)

2) The host will apply these changes throttled by 1 second so we don't get constant
   (expensive) refreshing of the text document when users type in the visual editor

3) The throttled edits are _flushed_ immediately when the user saves the document

*/

export interface EditorSyncManager {
  init: () => Promise<void>;
  onVisualEditorChanged: (state: unknown) => Promise<void>;
  flushPendingUpdates: () => Promise<void>;
  onDocumentChanged: () => Promise<void>;
  onDocumentSaving: () => Promise<TextEdit[]>;
  onDocumentSaved: () => Promise<void>;
}

// sync the document model w/ the visual editor
export function editorSyncManager(
  document: TextDocument,
  visualEditor: VSCodeVisualEditor,
  request: JsonRpcRequestTransport,
  navigation?: XRef | number
): EditorSyncManager {

  // state: an update from the visual editor that the document doesn't show yet. we don't
  // apply these on every keystoke b/c they are expensive. we poll to apply these
  // udpates periodically and also apply them immediately on save and when the
  // visual editor instructs us to do so (e.g. when it loses focus). we keep the
  // update until the document shows it, as vscode can discard a save's edits
  let pendingVisualEdit: unknown | undefined;

  // state: the markdown last written by or sent to the visual editor, and the update
  // it was written from (document changes to this markdown are not propagated to
  // the visual editor, and they complete the pending edit if it is this update)
  let syncedMarkdown: string | undefined;
  let syncedVisualEdit: unknown | undefined;

  // the document shows the synced markdown
  const onMarkdownSynced = () => {
    if (pendingVisualEdit === syncedVisualEdit) {
      pendingVisualEdit = undefined;
    }
  };

  // collect a pending edit, converting it to markdown and recording it as synced
  const collectPendingVisualEdit = async (): Promise<string | undefined> => {
    if (pendingVisualEdit) {
      const state = pendingVisualEdit;
      try {
        const markdown = await visualEditor.getMarkdownFromState(state);
        // the document shows this edit (or a later one) by now
        if (!pendingVisualEdit) {
          return undefined;
        }
        syncedMarkdown = markdown;
        syncedVisualEdit = state;
        return markdown;
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
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
    if (markdown === document.getText()) {
      onMarkdownSynced();
    } else if (markdown) {
      await updateWorkspaceDocument(document, markdown);
    }
  };

  // periodically collect and apply pending edits. note that we also
  // collect and apply automatically when a save occurs
  setInterval(collectAndApplyPendingVisualEdit, 2000);

  return {

    // initialize the connection to the visual editor by providing it
    // with its initial contents and syncing the canonnical markdown
    // back to the document
    init: async () => {
      // determine the current sourcePos
      const markdown = document.getText();
      let initialNav: NavLocation | undefined;
      if (markdown) {
        if (typeof (navigation) === "number") {
          const source = editorSourceJsonRpcServer(request);
          const locations = await source.getSourcePosLocations(markdown);
          initialNav = { locations, pos: navigation };
        } else if (isXRef(navigation)) {
          initialNav = navigation;
        }
      }

      const editorMarkdown = await visualEditor.init(markdown, initialNav);
      syncedMarkdown = editorMarkdown || markdown;
      if (editorMarkdown && (editorMarkdown !== document.getText())) {
        await updateWorkspaceDocument(document, editorMarkdown);
      }
    },

    // notification that the visual editor changed (enque the change)
    onVisualEditorChanged: async (state: unknown) => {
      pendingVisualEdit = state;
    },

    // flush
    flushPendingUpdates: collectAndApplyPendingVisualEdit,

    // notification that the document changed, let the visual editor know about
    // the change unless it is synced already or the visual editor has a pending
    // edit (which will be written over the change). note that the visual editor
    // will throttle these changes internally
    onDocumentChanged: async () => {
      const markdown = document.getText();
      if (markdown === syncedMarkdown) {
        onMarkdownSynced();
      } else if (!pendingVisualEdit) {
        syncedMarkdown = markdown;
        await visualEditor.applyExternalEdit(markdown);
      }
    },

    // notification that we are saving (allow flusing of visual editor changes)
    onDocumentSaving: async (): Promise<TextEdit[]> => {
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
    },

    // notification that a document completed saving (failsafe for changes
    // that didn't get applied b/c of onDocumentSaving no longer being
    // called b/c vscode deems that it is running for too long)
    onDocumentSaved: async (): Promise<void> => {
      collectAndApplyPendingVisualEdit();
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
