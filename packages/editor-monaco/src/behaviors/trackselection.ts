/*
 * trackselection.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import debounce from 'lodash.debounce';

import { EditorView as PMEditorView } from "prosemirror-view";
import { TextSelection, Transaction } from "prosemirror-state";

import { DispatchEvent, codeViewCellContext, kCodeViewNextLineTransaction } from "editor";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor, State } from ".";

// track the selection in prosemirror
export function trackSelectionBehavior(context: BehaviorContext): Behavior {

  let unsubscribe: VoidFunction;

  // 500ms debounced function for code view assist request
  const codeViewAssist = debounce(() => {
    // get path and context (bail if we can't)
    const filepath = context.pmContext.ui.context.getDocumentPath();
    if (!filepath) {
      return;
    }
    const cvContext = codeViewCellContext(filepath, context.view.state);
    if (cvContext) {
      context.pmContext.ui.codeview?.codeViewAssist(cvContext);
    }
  }, 500);

  return {

    init(_pmNode, editor) {
      unsubscribe = context.pmContext.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
        if (tr) {
          // track selection changes that occur when we don't have focus
          if (tr.selectionSet && !tr.docChanged && (tr.selection instanceof TextSelection)) {
            const selection = asEditorSelection(context.view, editor, context.getPos)
              ?? new monaco.Selection(1, 1, 1, 1);
            // don't echo back a selection that originated here (or that we
            // already have) or we'd lose the user's selection direction
            const current = editor.getSelection();
            if (!current || !current.equalsSelection(selection)) {
              context.withState(State.Updating, () => {
                editor.setSelection(selection);
              });
            }
          } else if (tr.getMeta(kCodeViewNextLineTransaction) === true) {
            // NOTE: this is a special directive to advance to the next line. as distinct
            // from the block above it is not a reporting of a change in the PM selection
            // but rather an instruction to move the selection to the next line. as
            // such we do not enclose the code in State.Updating, because we want an update
            // to the PM selection to occur
            const selection = asEditorSelection(context.view, editor, context.getPos);
            if (selection) {
              const before = editor.getPosition()?.lineNumber;
              editor.trigger("quarto", "cursorDown", null);
              if (editor.getPosition()?.lineNumber !== before) {
                editor.trigger("quarto", "cursorLineStart", null);
              }
            }
            // for other selection changes
          } else if (editor.hasTextFocus() && tr.selectionSet && (tr.selection instanceof TextSelection)) {
            codeViewAssist();
          }
        }
      });
    },

    cleanup: () => {
      codeViewAssist.cancel();
      unsubscribe?.();
    }
  };

}

/**
 * Map the prosemirror selection into a monaco selection for this code view
 * (undefined if the prosemirror selection doesn't intersect the code view)
 */
export const asEditorSelection = (
  pmView: PMEditorView,
  editor: CodeEditor,
  getPos: () => number | undefined
): monaco.Selection | undefined => {
  const model = editor.getModel();
  const pos = getPos();
  if (model && pos !== undefined) {
    const offset = pos + 1;
    const node = pmView.state.doc.nodeAt(pos);
    if (node) {
      const nodeSize = node.nodeSize;
      const selection = pmView.state.selection;
      const range = { from: offset, to: offset + nodeSize - 1 };
      const isWithin = (p: number) => p >= range.from && p < range.to;
      if (isWithin(selection.from) || isWithin(selection.to)) {
        // preserve the selection direction (anchor/head rather than from/to)
        const clamp = (p: number) => Math.max(0, Math.min(p - offset, model.getValueLength()));
        return monaco.Selection.fromPositions(
          model.getPositionAt(clamp(selection.anchor)),
          model.getPositionAt(clamp(selection.head))
        );
      } else if (selection.from <= range.from && selection.to >= range.to) {
        return monaco.Selection.fromPositions(
          model.getPositionAt(0),
          model.getPositionAt(model.getValueLength())
        );
      }
    }
  }
  return undefined;
};
