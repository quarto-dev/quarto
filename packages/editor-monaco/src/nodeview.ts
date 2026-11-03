/*
 * nodeview.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 *
 * ProseMirror NodeView that hosts a Monaco editor for a code node. The
 * ProseMirror document is the source of truth: user edits in Monaco are
 * forwarded to ProseMirror as transactions, and ProseMirror updates (undo,
 * collaboration, find/replace, etc.) are applied back to the Monaco model.
 */

import { Node } from "prosemirror-model";
import { EditorView as PMEditorView, NodeView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";

import {
  CodeEditorNodeView,
  CodeEditorNodeViews,
  CodeViewOptions,
  ExtensionContext
} from "editor";

import { monaco, initMonaco } from "./monaco";

import {
  createBehaviors,
  behaviorOptions,
  behaviorInit,
  behaviorPmUpdate,
  behaviorContentChanged,
  behaviorCleanup,
  State,
  CodeEditor
} from "./behaviors";

const kBaseOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  // layout: the editor grows to fit its content and never scrolls itself
  automaticLayout: true,
  scrollBeyondLastLine: false,
  scrollbar: {
    vertical: "hidden",
    horizontal: "hidden",
    alwaysConsumeMouseWheel: false,
    handleMouseWheel: false
  },
  wordWrap: "on",
  wrappingIndent: "none",
  // chrome: strip everything that isn't the text
  minimap: { enabled: false },
  lineNumbers: "off",
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: "none",
  contextmenu: false,
  stickyScroll: { enabled: false },
  // popups (suggest, hover) must escape the editor's clipped box
  fixedOverflowWidgets: true,
  // misc
  links: false,
  occurrencesHighlight: "off",
  selectionHighlight: false,
  renderWhitespace: "none",
  padding: { top: 4, bottom: 4 },
  unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false }
};

export const monacoNodeView: (
  context: ExtensionContext,
  codeViewOptions: CodeViewOptions,
  nodeViews: CodeEditorNodeViews
) => (
  pmNode: Node,
  view: PMEditorView,
  getPos: () => number | undefined
) => NodeView = (context, codeViewOptions, nodeViews) => (pmNode, view, getPos) => {

  initMonaco();

  // track node
  let node = pmNode;

  // scoped state and function to allow behaviors to set it
  let updating = false;
  let escaping = false;
  const withState = (state: State, fn: () => void) => {
    const setState = (value: boolean) => {
      if (state === State.Updating) updating = value;
      if (state === State.Escaping) escaping = value;
    };
    setState(true);
    try {
      fn();
    } finally {
      setState(false);
    }
  };

  // gap cursor pending state (set by the global nodeview click handler)
  let gapCursorPending = false;
  const setGapCursorPending = (pending: boolean) => {
    gapCursorPending = pending;
  };

  // track the last user selection in this code view so we can make it
  // sticky for when prosemirror calls setSelection (e.g. on a refocus,
  // where by default it passes 0,0)
  let lastUserSelection: { anchor: number, head: number } | undefined;

  // setup dom
  const dom = document.createElement("div");
  dom.classList.add("pm-code-editor");
  dom.classList.add("pm-monaco-editor");
  dom.classList.add(codeViewOptions.borderColorClass || "pm-block-border-color");
  if (codeViewOptions.classes) {
    codeViewOptions.classes.forEach(className => dom.classList.add(className));
  }
  const editorDom = document.createElement("div");
  editorDom.classList.add("pm-monaco-editor-container");
  dom.appendChild(editorDom);

  // create behaviors
  const behaviors = createBehaviors({
    dom,
    view,
    getPos,
    options: codeViewOptions,
    pmContext: context,
    withState
  });

  // create model and editor
  const model = monaco.editor.createModel(node.textContent);
  model.setEOL(monaco.editor.EndOfLineSequence.LF);
  const editor: CodeEditor = monaco.editor.create(editorDom, {
    ...kBaseOptions,
    ...behaviorOptions(behaviors),
    model
  });

  // size the editor to its content
  const layout = () => {
    const height = editor.getContentHeight();
    editorDom.style.height = `${height}px`;
    editor.layout({ width: editorDom.clientWidth, height });
  };
  editor.onDidContentSizeChange(layout);
  layout();

  // forward user edits to prosemirror
  editor.onDidChangeModelContent((ev) => {
    if (!updating) {
      valueChanged(modelText(model), node, getPos, view);
      forwardSelection(editor, view, getPos);
      trackUserSelection();
    }
    behaviorContentChanged(behaviors, ev, editor, node);
  });

  // forward user selection changes to prosemirror
  const trackUserSelection = () => {
    const sel = editor.getSelection();
    if (sel) {
      const anchor = model.getOffsetAt(sel.getSelectionStart());
      const head = model.getOffsetAt(sel.getPosition());
      if (anchor !== 0 || head !== 0) {
        lastUserSelection = { anchor, head };
      }
    }
  };
  editor.onDidChangeCursorSelection(() => {
    if (!updating) {
      forwardSelection(editor, view, getPos);
      trackUserSelection();
    }
  });

  // initialize behaviors
  behaviorInit(behaviors, node, editor);

  // track node view (this is done both so the outer editor can direct
  // commands at the currently active nodeview, as well as for click
  // detection between views for gap cursor handling)
  const codeNodeView: CodeEditorNodeView = {
    isFocused: () => editor.hasTextFocus(),
    getPos: () => getPos() ?? 0,
    dom,
    setGapCursorPending
  };
  nodeViews.add(codeNodeView);

  // helper to set the monaco selection from prosemirror offsets
  const setEditorSelection = (anchor: number, head: number) => {
    const anchorPos = model.getPositionAt(anchor);
    const headPos = model.getPositionAt(head);
    withState(State.Updating, () => {
      editor.setSelection(monaco.Selection.fromPositions(anchorPos, headPos));
    });
  };

  return {

    dom,

    selectNode() {
      editor.focus();
    },

    stopEvent: () => true,

    setSelection: (anchor, head) => {

      // if prosemirror attempts to set us to 0,0 (which it does on focus)
      // just restore our last user selection
      if (anchor === 0 && head === 0 && lastUserSelection) {
        anchor = lastUserSelection.anchor;
        head = lastUserSelection.head;
      }

      // reflect the prosemirror selection change into monaco (do this before
      // forwarding, otherwise we'd forward monaco's stale selection back to
      // prosemirror and clobber the one it just asked for)
      setEditorSelection(anchor, head);

      // set focus and forward selection unless our state precludes this (the
      // forward only matters if we restored a sticky user selection above)
      if (!escaping && !gapCursorPending) {
        editor.focus();
        forwardSelection(editor, view, getPos);
      }
    },

    update: (updateNode) => {

      // if the node type changed, no update (standard prosemirror boilerplate)
      if (updateNode.type.name !== node.type.name) {
        return false;
      }

      // update node (track prevNode to pass to behaviors)
      const prevNode = node;
      node = updateNode;

      // apply change from update node
      const change = computeChange(modelText(model), node.textContent);
      if (change) {
        withState(State.Updating, () => {
          const range = monaco.Range.fromPositions(
            model.getPositionAt(change.from),
            model.getPositionAt(change.to)
          );
          model.applyEdits([{ range, text: change.text }]);
          const cursor = model.getPositionAt(change.from + change.text.length);
          editor.setSelection(monaco.Selection.fromPositions(cursor, cursor));
        });
      }

      // trigger update for behaviors
      behaviorPmUpdate(behaviors, prevNode, updateNode, editor);

      // success
      return true;
    },

    ignoreMutation: () => true,

    destroy: () => {
      behaviorCleanup(behaviors);
      nodeViews.remove(codeNodeView);
      editor.dispose();
      model.dispose();
    },
  };
};

const modelText = (model: monaco.editor.ITextModel) =>
  model.getValue(monaco.editor.EndOfLinePreference.LF);

const computeChange = (oldVal: string, newVal: string) => {
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
};

const asProseMirrorSelection = (
  pmDoc: Node,
  editor: CodeEditor,
  getPos: () => number | undefined
) => {
  const model = editor.getModel()!;
  const sel = editor.getSelection()!;
  const offset = (getPos() ?? 0) + 1;
  const anchor = model.getOffsetAt(sel.getSelectionStart()) + offset;
  const head = model.getOffsetAt(sel.getPosition()) + offset;
  return TextSelection.create(pmDoc, anchor, head);
};

const forwardSelection = (
  editor: CodeEditor,
  pmView: PMEditorView,
  getPos: () => number | undefined
) => {
  if (!editor.hasTextFocus()) return;
  const selection = asProseMirrorSelection(pmView.state.doc, editor, getPos);
  if (!selection.eq(pmView.state.selection))
    pmView.dispatch(pmView.state.tr.setSelection(selection));
};

const valueChanged = (
  textUpdate: string,
  node: Node,
  getPos: () => number | undefined,
  view: PMEditorView
) => {
  const change = computeChange(node.textContent, textUpdate);
  const pos = getPos();
  if (change && pos !== undefined) {
    const start = pos + 1;
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
      );
    }
    view.dispatch(pmTr);
  }
};
