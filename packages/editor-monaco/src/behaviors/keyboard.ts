/*
 * keyboard.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { EditorView as PMEditorView } from "prosemirror-view";
import { undo, redo } from "prosemirror-history";
import { exitCode, setBlockType } from "prosemirror-commands";

import { codeViewActiveBlockContext, handleArrowToAdjacentNode } from "editor";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor, State } from ".";

const { KeyMod, KeyCode } = monaco;

// context keys used as preconditions for our keybindings (so that when they
// don't apply monaco's default handling of the key is used)
const kCanEscapeUp = "quartoCodeViewCanEscapeUp";
const kCanEscapeDown = "quartoCodeViewCanEscapeDown";
const kCanEscapeLeft = "quartoCodeViewCanEscapeLeft";
const kCanEscapeRight = "quartoCodeViewCanEscapeRight";
const kAtStart = "quartoCodeViewAtStart";

// don't let monaco consume keys that the host binds (render, run line)
monaco.editor.addKeybindingRules([
  { keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK, command: null },
  { keybinding: KeyMod.Alt | KeyCode.Enter, command: null },
  { keybinding: KeyMod.CtrlCmd | KeyCode.KeyF, command: null },
]);

export function keyboardBehavior(context: BehaviorContext): Behavior {

  const { view, getPos } = context;

  const escape = (dir: 1 | -1, editor: CodeEditor) => {
    context.withState(State.Escaping, () => {
      const pos = getPos();
      if (pos !== undefined) {
        view.focus();
        handleArrowToAdjacentNode(pos, dir, view.state, view.dispatch);
        view.focus();
      }
    });
    // keep monaco's selection out of the way (prosemirror now owns focus)
    editor.setSelection(new monaco.Selection(1, 1, 1, 1));
  };

  return {
    init(_pmNode, editor) {

      const canEscapeUp = editor.createContextKey<boolean>(kCanEscapeUp, false);
      const canEscapeDown = editor.createContextKey<boolean>(kCanEscapeDown, false);
      const canEscapeLeft = editor.createContextKey<boolean>(kCanEscapeLeft, false);
      const canEscapeRight = editor.createContextKey<boolean>(kCanEscapeRight, false);
      const atStart = editor.createContextKey<boolean>(kAtStart, false);

      const updateContextKeys = () => {
        const model = editor.getModel();
        const sel = editor.getSelection();
        if (!model || !sel) {
          return;
        }
        const empty = sel.isEmpty();
        const pos = sel.getPosition();
        const lastLine = model.getLineCount();
        canEscapeUp.set(empty && pos.lineNumber === 1);
        canEscapeDown.set(empty && pos.lineNumber === lastLine);
        canEscapeLeft.set(empty && pos.lineNumber === 1 && pos.column === 1);
        canEscapeRight.set(empty && pos.lineNumber === lastLine && pos.column === model.getLineMaxColumn(lastLine));
        atStart.set(empty && pos.lineNumber === 1 && pos.column === 1);
      };
      updateContextKeys();
      editor.onDidChangeCursorSelection(updateContextKeys);
      editor.onDidChangeModelContent(updateContextKeys);

      const notPopup = "!suggestWidgetVisible && !parameterHintsVisible";

      editor.addAction({
        id: "quarto.codeview.escapeUp",
        label: "Move to Previous Block",
        keybindings: [KeyCode.UpArrow],
        precondition: `${kCanEscapeUp} && ${notPopup}`,
        run: (ed) => escape(-1, ed as CodeEditor)
      });
      editor.addAction({
        id: "quarto.codeview.escapeLeft",
        label: "Move to Previous Block",
        keybindings: [KeyCode.LeftArrow],
        precondition: `${kCanEscapeLeft} && ${notPopup}`,
        run: (ed) => escape(-1, ed as CodeEditor)
      });
      editor.addAction({
        id: "quarto.codeview.escapeDown",
        label: "Move to Next Block",
        keybindings: [KeyCode.DownArrow],
        precondition: `${kCanEscapeDown} && ${notPopup}`,
        run: (ed) => escape(1, ed as CodeEditor)
      });
      editor.addAction({
        id: "quarto.codeview.escapeRight",
        label: "Move to Next Block",
        keybindings: [KeyCode.RightArrow],
        precondition: `${kCanEscapeRight} && ${notPopup}`,
        run: (ed) => escape(1, ed as CodeEditor)
      });

      // undo/redo are routed to prosemirror (which owns the document history)
      editor.addAction({
        id: "quarto.codeview.undo",
        label: "Undo",
        keybindings: [KeyMod.CtrlCmd | KeyCode.KeyZ],
        run: () => { undo(view.state, view.dispatch); }
      });
      editor.addAction({
        id: "quarto.codeview.redo",
        label: "Redo",
        keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, KeyMod.CtrlCmd | KeyCode.KeyY],
        run: () => { redo(view.state, view.dispatch); }
      });

      // backspace at the very start of the block converts it to a paragraph
      editor.addAction({
        id: "quarto.codeview.backspaceAtStart",
        label: "Convert to Paragraph",
        keybindings: [KeyCode.Backspace, KeyMod.CtrlCmd | KeyCode.Backspace],
        precondition: `${kAtStart} && ${notPopup}`,
        run: () => backspaceAtStart(view)
      });

      // shift-enter executes the cell (or exits the code block if not executable)
      editor.addAction({
        id: "quarto.codeview.shiftEnter",
        label: "Run Cell",
        keybindings: [KeyMod.Shift | KeyCode.Enter],
        precondition: notPopup,
        run: (ed) => {
          const cvContext = codeViewActiveBlockContext(view.state);
          if (cvContext && context.pmContext.ui.context.executableLanguges?.().includes(cvContext.activeLanguage)) {
            context.pmContext.ui.codeview?.codeViewExecute("cell+advance", cvContext);
          } else {
            const model = ed.getModel();
            const sel = ed.getSelection();
            if (model && sel && sel.isEmpty() &&
              model.getOffsetAt(sel.getPosition()) === model.getValueLength()) {
              exitCode(view.state, view.dispatch);
              view.focus();
            } else {
              ed.trigger("keyboard", "type", { text: "\n" });
            }
          }
        }
      });
    }
  };
}

const backspaceAtStart = (pmView: PMEditorView) => {
  setBlockType(pmView.state.schema.nodes.paragraph)(pmView.state, pmView.dispatch);
  setTimeout(() => pmView.focus(), 20);
};
