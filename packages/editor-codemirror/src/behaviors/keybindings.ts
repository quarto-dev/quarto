/*
 * keybindings.ts
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
import { undo, redo } from "prosemirror-history";
import { exitCode, selectAll, setBlockType } from "prosemirror-commands";

import { EditorView, KeyBinding, keymap } from "@codemirror/view";

import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";

import { maybeEscape } from "../utils";

import { Behavior, BehaviorContext, BehaviorState } from ".";

export function keybindingsBehavior(context: BehaviorContext) : Behavior {

  // alias context
  const { view, getPos } = context;

  // arrow key handler
  const handleArrowKey = (unit: "char" | "line", dir: 1 | -1) => {
    return (cmView: EditorView) => {
      let result = false;
      context.withState(BehaviorState.Escaping, () => {
        result = maybeEscape(unit, dir, cmView, view, getPos);
      });
      return result;
    };
  };

  // our baseline keys
  const keys = [
    {
      key: "ArrowUp",
      run: handleArrowKey("line", -1),
    },
    {
      key: "ArrowLeft",
      run: handleArrowKey("char", -1),
    },
    {
      key: "ArrowDown",
      run: handleArrowKey("line", 1),
    },
    {
      key: "ArrowRight",
      run: handleArrowKey("char", 1),
    },
    {
      key: "Mod-z",
      run: () => undo(view.state, view.dispatch) || true,
      shift: () => redo(view.state, view.dispatch) || true,
    },
    {
      key: "Mod-y",
      run: () => redo(view.state, view.dispatch) || true,
    },
    { key: "Backspace", run: (cmView: EditorView) => backspaceHandler(view, cmView) },
    {
      key: "Mod-Backspace",
      run: (cmView: EditorView) => backspaceHandler(view, cmView),
    },
    {
      key: "Mod-a",
      run: () => {
        const result = selectAll(view.state, view.dispatch);
        view.focus();
        return result;
      },
    },
    {
      key: "Shift-Enter",
      run: (cmView: EditorView) => {
        const sel = cmView.state.selection.main;
        if (sel.from === sel.to &&
            sel.from === cmView.state.doc.length
        ) {
          exitCode(view.state, view.dispatch);
          view.focus();
          return true;
        }
        return false;
      },
    },
  ];

  // bring in vscode keybindings (but remove ones we already have bound + Shift-Mod-k)
  const excludeKeys = [
    'Shift-Mod-k',  // render (this is yank line in default vscode keybindings)
    'Mod-f'         // find (we handle this with our own cross editor find)
  ];
  const baseKeys = keys.map(key => key.key!).concat(excludeKeys);
  const vscodeKeys = vscodeKeymap.filter(binding => !binding.key || !baseKeys.includes(binding.key));

  return {
    extensions: [keymap.of([...keys, ...vscodeKeys] as KeyBinding[])],
  }
}


const backspaceHandler = (pmView: PMEditorView, view: EditorView) => {
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
