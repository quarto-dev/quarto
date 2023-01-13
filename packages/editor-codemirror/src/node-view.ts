/*
 * node-view.ts
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


import { Node } from "prosemirror-model";
import { EditorView as PMEditorView, NodeView } from "prosemirror-view";
import { undo, redo } from "prosemirror-history";

import { lineNumbers } from "@codemirror/view";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  drawSelection,
  EditorView,
  keymap,
} from "@codemirror/view";
import {
  highlightSelectionMatches,
  selectNextOccurrence,
} from "@codemirror/search";
import { indentOnInput } from "@codemirror/language";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { Compartment, EditorState, SelectionRange, EditorSelection } from "@codemirror/state";
import { exitCode, selectAll } from "prosemirror-commands";

import {
  asCodeMirrorSelection,
  backspaceHandler,
  computeChange,
  forwardSelection,
  maybeEscape,
  setMode,
  valueChanged,
} from "./utils";
import { CodeViewOptions, DispatchEvent, ExtensionContext } from "editor";
import { Transaction } from "prosemirror-state";

export const codeMirrorBlockNodeView: (
  context: ExtensionContext,
  codeViewOptions: CodeViewOptions
) => (
  pmNode: Node,
  view: PMEditorView,
  getPos: (() => number) | boolean
) => NodeView = (context, codeViewOptions) => (pmNode, view, getPos) => {

  // create theme
  const theme = EditorView.theme({
    "&.cm-editor.cm-focused": {
      outline: "none"
    },
  }, {dark: false})

  let node = pmNode;
  let updating = false;
  const dom = document.createElement("div");
  dom.classList.add('pm-code-editor');
  dom.classList.add('pm-codemirror-editor');
  dom.classList.add('pm-codemirror-editor-inactive');
  dom.classList.add(codeViewOptions.borderColorClass || 'pm-block-border-color');
  if (codeViewOptions.classes) {
    codeViewOptions.classes.forEach(className => dom.classList.add(className));
  }
  const languageConf = new Compartment();
  const state = EditorState.create({
    extensions: [
      ...(codeViewOptions.lineNumbers ? [lineNumbers()] : []),
      closeBrackets(),
      highlightSelectionMatches(),
      indentUnit.of('  '),
      drawSelection({ cursorBlinkRate: 1000 }),
      syntaxHighlighting(defaultHighlightStyle),
      languageConf.of([]),
      indentOnInput(),
      keymap.of([
        { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
        {
          key: "ArrowUp",
          run: (cmView) => maybeEscape("line", -1, cmView, view, getPos),
        },
        {
          key: "ArrowLeft",
          run: (cmView) => maybeEscape("char", -1, cmView, view, getPos),
        },
        {
          key: "ArrowDown",
          run: (cmView) => maybeEscape("line", 1, cmView, view, getPos),
        },
        {
          key: "ArrowRight",
          run: (cmView) => maybeEscape("char", 1, cmView, view, getPos),
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
        { key: "Backspace", run: (cmView) => backspaceHandler(view, cmView) },
        {
          key: "Mod-Backspace",
          run: (cmView) => backspaceHandler(view, cmView),
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
          run: (cmView) => {
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
        ...(defaultKeymap.filter(mapping => mapping.key !== 'Shift-Mod-k')),
        ...closeBracketsKeymap,
        indentWithTab
      ]),
      theme,
    ],
    doc: node.textContent,
  });

  // track the last user selection in this code view so we can make it 
  // sticky for when prosemirror calls setSelection (e.g. on a refocus,
  // where by default it passes 0,0)
  let lastUserSelection: SelectionRange | undefined;

  const codeMirrorView = new EditorView({
    state,
    dispatch: (tr) => {
      codeMirrorView.update([tr]);
      if (!updating) {
        const textUpdate = tr.state.toJSON().doc;
        valueChanged(textUpdate, node, getPos, view);
        forwardSelection(codeMirrorView, view, getPos);
        // track last user selection that isn't at the origin
        if (codeMirrorView.state.selection.main.anchor !== 0) {
          lastUserSelection = codeMirrorView.state.selection.main;
        } 
      }
    },
  });
  dom.append(codeMirrorView.dom);

  const nodeLang = (nd: Node) => codeViewOptions.lang(nd, nd.textContent) || '';

  setMode(
    nodeLang(node), 
    codeMirrorView, 
    languageConf
  );

  // subscribe to dispatches
  const cleanup: VoidFunction[] = [];
  cleanup.push(context.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
    if (tr) {
      // track selection changes that occur when we don't have focus
      if (!codeMirrorView.hasFocus && tr.selectionSet && !tr.docChanged) {
        const cmSelection = asCodeMirrorSelection(view, codeMirrorView, getPos);
        updating = true;
        if (cmSelection) {
          codeMirrorView.dispatch({ selection: cmSelection });
        } else {
          codeMirrorView.dispatch({ selection: EditorSelection.single(0)})
        } 
        updating = false;
      }
    }
  }));

  return {
    dom,
    selectNode() {
      codeMirrorView.focus();
    },
    stopEvent: () => true,
    setSelection: (anchor, head) => {
      // if prosemirror attempts to set us to 0,0 (which it does on focus)
      // just restore our last user selection
      if (anchor === 0 && head === 0 && lastUserSelection) {
        anchor = lastUserSelection.anchor;
        head = lastUserSelection.head;
      }
      codeMirrorView.focus();
      forwardSelection(codeMirrorView, view, getPos);
      updating = true;
      codeMirrorView.dispatch({
        selection: { anchor: anchor, head: head },
      });
      updating = false;
    },
    update: (updateNode) => {
      if (updateNode.type.name !== node.type.name) return false;
      if (nodeLang(updateNode)!== nodeLang(node))
        setMode(nodeLang(updateNode), codeMirrorView, languageConf);
      node = updateNode;
      const change = computeChange(
        codeMirrorView.state.doc.toString(),
        node.textContent
      );
      if (change) {
        updating = true;
        codeMirrorView.dispatch({
          changes: {
            from: change.from,
            to: change.to,
            insert: change.text,
          },
          selection: { anchor: change.from + change.text.length },
        });
        updating = false;
      } 
  
      return true;
    },
    ignoreMutation: () => true,
    destroy: () => {
      cleanup.forEach(clean => clean());
      codeMirrorView.destroy();
    },
  };
};
