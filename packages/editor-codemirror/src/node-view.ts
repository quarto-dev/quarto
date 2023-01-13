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
import { Transaction } from "prosemirror-state";
import { GapCursor } from "prosemirror-gapcursor"
import { exitCode, selectAll } from "prosemirror-commands";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  drawSelection,
  EditorView,
  keymap,
  KeyBinding,
  lineNumbers,
  Decoration
} from "@codemirror/view";
import {
  highlightSelectionMatches,
  selectNextOccurrence,
} from "@codemirror/search";
import { indentOnInput } from "@codemirror/language";
import { indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentUnit } from "@codemirror/language";
import { Compartment, EditorState, SelectionRange, EditorSelection, Range, RangeSet } from "@codemirror/state";

import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";

import { CodeEditorNodeView, CodeEditorNodeViews, CodeViewOptions, DispatchEvent, ExtensionContext, findPluginState } from "editor";

import {
  asCodeMirrorSelection,
  backspaceHandler,
  computeChange,
  forwardSelection,
  maybeEscape,
  setMode,
  valueChanged,
} from "./utils";

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

  // updating state
  let updating = false;
  
  // escaping state
  let escaping = false;
  const handleArrowKey = (unit: "char" | "line", dir: 1 | -1) => {
    return (cmView: EditorView) => {
      escaping = true;
      const result = maybeEscape(unit, dir, cmView, view, getPos);
      escaping = false;
      return result;
    };
  };

  // gap cursor pending state
  let gapCursorPending = false;
  const setGapCursorPending = (pending: boolean) => {
    gapCursorPending = pending;
  }

  // our baseline keys
  const keys = [
    { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
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
  const excludeKeys = ['Shift-Mod-k', 'Mod-f'];
  const baseKeys = keys.map(key => key.key!).concat(excludeKeys);
  const vscodeKeys = vscodeKeymap.filter(binding => !binding.key || !baseKeys.includes(binding.key));

  // setup dom
  const dom = document.createElement("div");
  dom.classList.add('pm-code-editor');
  dom.classList.add('pm-codemirror-editor');
  dom.classList.add('pm-codemirror-editor-inactive');
  dom.classList.add(codeViewOptions.borderColorClass || 'pm-block-border-color');
  if (codeViewOptions.classes) {
    codeViewOptions.classes.forEach(className => dom.classList.add(className));
  }

  // aspects of the editor we want to dynamically reconfigure
  const findDecoratorMark = Decoration.mark({class: "pm-find-text"})
  const findDecorators = new Compartment();
  const languageConf = new Compartment();

  // editor state
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
        ...keys,
        ...vscodeKeys,
        ...closeBracketsKeymap,
        indentWithTab
      ] as KeyBinding[]),
      theme,
      findDecorators.of([])
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

      // update find markers
      const findMarkers: Range<Decoration>[] = [];
      const decorations = findPluginState(view.state);      
      if (decorations && typeof getPos === "function") {
        const decos = decorations?.find(getPos(), getPos() + node.nodeSize - 1);
        if (decos) {
          decos.forEach((deco) => {
            if (deco.from !== view.state.selection.from && deco.to !== view.state.selection.to) {
              findMarkers.push(findDecoratorMark.range(deco.from - getPos() - 1, deco.to - getPos() -1));
            }
          })
        }
      }
      const ranges = RangeSet.of<Decoration>(findMarkers);
      codeMirrorView.dispatch({
        effects: findDecorators.reconfigure(EditorView.decorations.of(ranges))
      });


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
