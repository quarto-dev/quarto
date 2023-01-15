/*
 * trackselection.ts
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

import { EditorView as PMEditorView } from "prosemirror-view";
import { GapCursor } from "prosemirror-gapcursor";
import { Transaction } from "prosemirror-state";

import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { DispatchEvent } from "editor";

import { Behavior, BehaviorContext, State } from ".";

// track the selection in prosemirror
export function trackSelectionBehavior(context: BehaviorContext) : Behavior {

  let unsubscibe: VoidFunction;

  return {

    extensions: [],

    init(_pmNode, cmView) {
      unsubscibe = context.pmContext.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
        if (tr) {
          // track selection changes that occur when we don't have focus
          if (!cmView.hasFocus && tr.selectionSet && !tr.docChanged && !(tr.selection instanceof GapCursor)) {
            const cmSelection = asCodeMirrorSelection(context.view, cmView, context.getPos);
            context.withState(State.Updating, () => {
              if (cmSelection) {
                cmView.dispatch({ selection: cmSelection });
              } else {
                cmView.dispatch({ selection: EditorSelection.single(0)})
              } 
            })
          }
        }
      });
    },

    cleanup: () => {
      unsubscibe?.();
    }
  };

}

const asCodeMirrorSelection = (
  pmView: PMEditorView,
  cmView: EditorView,
  getPos: (() => number) | boolean
) => {
  if (typeof(getPos) === "function") {
    const offset = getPos() + 1;
    const node = pmView.state.doc.nodeAt(getPos());
    if (node) {
      const nodeSize = node.nodeSize;
      const selection = pmView.state.selection;
      const cmRange = { from: offset, to: offset + nodeSize };
      const isWithinCm = (pos: number) => pos >= cmRange.from && pos < cmRange.to;
      if (isWithinCm(selection.from) || isWithinCm(selection.to)) {
        return EditorSelection.single(selection.from - offset, selection.to - offset);
      } else if (selection.from <= cmRange.from && selection.to >= cmRange.to) {
        return EditorSelection.single(0, cmView.state.doc.length);
      }
    }
  }
  return undefined;
}