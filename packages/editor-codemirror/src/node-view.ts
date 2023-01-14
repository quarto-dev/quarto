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
import { Transaction } from "prosemirror-state";
import { GapCursor } from "prosemirror-gapcursor"

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  drawSelection,
  EditorView,
  keymap,
  KeyBinding,
  lineNumbers
} from "@codemirror/view";
import {
  highlightSelectionMatches,
} from "@codemirror/search";
import { indentOnInput } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { EditorState, SelectionRange, EditorSelection } from "@codemirror/state";

import { 
  CodeEditorNodeView, 
  CodeEditorNodeViews, 
  CodeViewOptions, 
  DispatchEvent, 
  ExtensionContext 
} from "editor";

import {
  asCodeMirrorSelection,
  computeChange,
  forwardSelection,
  valueChanged,
} from "./utils";
import { 
  createBehaviors,
  behaviorExtensions, 
  behaviorInit, 
  behaviorPmUpdate, 
  BehaviorState, 
} from "./behaviors";

export const codeMirrorBlockNodeView: (
  context: ExtensionContext,
  codeViewOptions: CodeViewOptions,
  nodeViews: CodeEditorNodeViews
) => (
  pmNode: Node,
  view: PMEditorView,
  getPos: (() => number) | boolean
) => NodeView = (context, codeViewOptions, nodeViews) => (pmNode, view, getPos) => {

  // create theme
  const theme = EditorView.theme({
    "&.cm-editor.cm-focused": {
      outline: "none"
    },
  }, {dark: false})

  // track node
  let node = pmNode;

  // state and function to allow behaviors to set it
  let updating = false;
  let escaping = false;
  const withState = (state: BehaviorState, fn: () => void) => {
    const setState = (value: boolean) => {
      if (state === BehaviorState.Updating) updating = value;
      if (state === BehaviorState.Escaping) escaping = value;
    }
    setState(true);
    fn();
    setState(false);
  }


  // gap cursor pending state
  let gapCursorPending = false;
  const setGapCursorPending = (pending: boolean) => {
    gapCursorPending = pending;
  }

  // setup dom
  const dom = document.createElement("div");
  dom.classList.add('pm-code-editor');
  dom.classList.add('pm-codemirror-editor');
  dom.classList.add('pm-codemirror-editor-inactive');
  dom.classList.add(codeViewOptions.borderColorClass || 'pm-block-border-color');
  if (codeViewOptions.classes) {
    codeViewOptions.classes.forEach(className => dom.classList.add(className));
  }

  // behaviors
  const behaviors = createBehaviors({
    view,
    getPos,
    options: codeViewOptions,
    pmContext: context,
    withState
  })

  // editor state
  const state = EditorState.create({
    extensions: [
      ...(codeViewOptions.lineNumbers ? [lineNumbers()] : []),
      closeBrackets(),
      highlightSelectionMatches(),
      indentUnit.of('  '),
      drawSelection({ cursorBlinkRate: 1000 }),
      syntaxHighlighting(defaultHighlightStyle),

      ...behaviorExtensions(behaviors),
      
      indentOnInput(),
      keymap.of([...closeBracketsKeymap, indentWithTab] as KeyBinding[]),
      theme
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

  // initialize behaviors
  behaviorInit(behaviors, node, codeMirrorView);

  // subscribe to dispatches
  const cleanup: VoidFunction[] = [];
  cleanup.push(context.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
    if (tr) {
      // track selection changes that occur when we don't have focus
      if (!codeMirrorView.hasFocus && tr.selectionSet && !tr.docChanged && !(tr.selection instanceof GapCursor)) {
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

  // track node view
  const cmNodeView : CodeEditorNodeView = {
    isFocused: () => codeMirrorView.hasFocus,
    getPos: typeof(getPos) === "function" ? getPos : (() => 0),
    dom,
    setGapCursorPending
  }; 
  nodeViews.add(cmNodeView);

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
      if (!escaping && !gapCursorPending) {
        codeMirrorView.focus();
        forwardSelection(codeMirrorView, view, getPos);
      }
      updating = true;
      codeMirrorView.dispatch({
        selection: { anchor: anchor, head: head },
      });
      updating = false;
    },
    update: (updateNode) => {
      if (updateNode.type.name !== node.type.name) return false;
    
      // apply change from update node
      const change = computeChange(
        codeMirrorView.state.doc.toString(),
        updateNode.textContent
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

      // trigger update for behaviors
      behaviorPmUpdate(behaviors, node, updateNode, codeMirrorView);

      // reset node
      node = updateNode;

      return true;
    },
    ignoreMutation: () => true,
    destroy: () => {
      cleanup.forEach(clean => clean());
      nodeViews.remove(cmNodeView);
      codeMirrorView.destroy();
    },
  };
};
