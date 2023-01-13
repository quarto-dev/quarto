/*
 * utils.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
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

// From prosemirror guide
import {
  TextSelection,
  Selection,
  EditorState,
  Transaction,
} from "prosemirror-state";
import { EditorView as PMEditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { GapCursor } from 'prosemirror-gapcursor';
import { EditorView } from "@codemirror/view";
import { setBlockType } from "prosemirror-commands";
import { Compartment, EditorSelection } from "@codemirror/state";
import { languageMode } from "./languages";

export function computeChange(oldVal: string, newVal: string) {
  if (oldVal === newVal) return null;
  let start = 0;
  let oldEnd = oldVal.length;
  let newEnd = newVal.length;
  while (
    start < oldEnd &&
    oldVal.charCodeAt(start) === newVal.charCodeAt(start)
  )
    start += 1;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldVal.charCodeAt(oldEnd - 1) === newVal.charCodeAt(newEnd - 1)
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { from: start, to: oldEnd, text: newVal.slice(start, newEnd) };
}

export const asProseMirrorSelection = (
  pmDoc: Node,
  cmView: EditorView,
  getPos: (() => number) | boolean
) => {
  const offset = (typeof getPos === "function" ? getPos() || 0 : 0) + 1;
  const anchor = cmView.state.selection.main.from + offset;
  const head = cmView.state.selection.main.to + offset;
  return TextSelection.create(pmDoc, anchor, head);
};

// returns undefined if the selection is not within us or not a range
export const asCodeMirrorSelection = (
  pmView: PMEditorView,
  getPos: (() => number) | boolean
) => {
  if (typeof(getPos) === "function") {
    const offset = getPos() + 1;
    const node = pmView.state.doc.nodeAt(getPos());
    if (node) {
      const nodeSize = node.nodeSize;
      const selection = pmView.state.selection;
      const isWithinCm = (pos: number) => pos >= offset && pos < (offset + nodeSize);
      if (isWithinCm(selection.from) || isWithinCm(selection.to)) {
        return EditorSelection.single(selection.from - offset, selection.to - offset);
      }
    }
  }
}

export const forwardSelection = (
  cmView: EditorView,
  pmView: PMEditorView,
  getPos: (() => number) | boolean
) => {
  if (!cmView.hasFocus) return;
  const selection = asProseMirrorSelection(pmView.state.doc, cmView, getPos);
  if (!selection.eq(pmView.state.selection))
    pmView.dispatch(pmView.state.tr.setSelection(selection));
};

export const valueChanged = (
  textUpdate: string,
  node: Node,
  getPos: (() => number) | boolean,
  view: PMEditorView
) => {
  const change = computeChange(node.textContent, textUpdate);
  if (change && typeof getPos === "function") {
    const start = getPos() + 1;

    const pmTr = view.state.tr;
    if (change.text) {
      pmTr.replaceWith(
        start + change.from,
        start + change.to,
        view.state.schema.text(change.text)
      );
    } else {
      pmTr.deleteRange(
        start + change.from,
        start + change.to
      )
    }
    view.dispatch(pmTr);
  }
};

export const maybeEscape = (
  unit: "char" | "line",
  dir: -1 | 1,
  cm: EditorView,
  view: PMEditorView,
  getPos: boolean | (() => number)
) => {
  const sel = cm.state.selection.main;
  const line = cm.state.doc.lineAt(sel.from);
  const lastLine = cm.state.doc.lines;
  if (
    sel.to !== sel.from ||
    line.number !== (dir < 0 ? 1 : lastLine) ||
    (unit === "char" && sel.from !== (dir < 0 ? 0 : line.to)) ||
    typeof getPos !== "function"
  )
    return false;
  view.focus();
  const node = view.state.doc.nodeAt(getPos());
  if (!node) return false;
  const targetPos = getPos() + (dir < 0 ? 0 : node.nodeSize);
  const selection = Selection.near(view.state.doc.resolve(targetPos), dir);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
  return true;
};

export const backspaceHandler = (pmView: PMEditorView, view: EditorView) => {
  const { selection } = view.state;
  if (selection.main.empty && selection.main.from === 0) {
    setBlockType(pmView.state.schema.nodes.paragraph)(
      pmView.state,
      pmView.dispatch
    );
    setTimeout(() => pmView.focus(), 20);
    return true;
  }
  return false;
};

export const setMode = (
  lang: string,
  cmView: EditorView,
  languageConf: Compartment
) => {
  const support = languageMode(lang);
  if (support)
    cmView.dispatch({
      effects: languageConf.reconfigure(support),
    });
};




export function arrowHandler(dir: 'up' | 'down' | 'left' | 'right', nodeTypes: string[]) {
  return (state: EditorState, dispatch?: (tr: Transaction) => void, view?: PMEditorView) => {
    if (state.selection.empty && !(state.selection instanceof GapCursor) && view && view.endOfTextblock(dir)) {
      const side = dir === 'left' || dir === 'up' ? -1 : 1;
      const $head = state.selection.$head;
      const nextPos = Selection.near(state.doc.resolve(side > 0 ? $head.after() : $head.before()), side);
      if (nextPos.$head && nodeTypes.includes(nextPos.$head.parent.type.name)) {
        // check for e.g. math where you can advance across embedded newlines
        if ((dir === 'up' || dir === 'down') && verticalArrowCanAdvanceWithinTextBlock(state.selection, dir)) {
          return false;
        }
        if (dispatch) {
          dispatch(state.tr.setSelection(nextPos));
        }
        return true;
      }
    }
    return false;
  };
}


export function verticalArrowCanAdvanceWithinTextBlock(selection: Selection, dir: 'up' | 'down') {
  const $head = selection.$head;
  const node = $head.node();
  if (node.isTextblock) {
    const cursorOffset = $head.parentOffset;
    const nodeText = node.textContent;
    if (dir === 'down' && nodeText.substr(cursorOffset).includes('\n')) {
      return true;
    }
    if (dir === 'up' && nodeText.substr(0, cursorOffset).includes('\n')) {
      return true;
    }
  }
  return false;
}
