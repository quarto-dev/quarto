/*
 * find.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { scrollCodeViewElementIntoView } from "editor";

import { monaco } from "../monaco";

import { Behavior, BehaviorContext, CodeEditor } from ".";

export function findBehavior(context: BehaviorContext): Behavior {

  const { view, getPos } = context;

  let findDecorations: monaco.editor.IEditorDecorationsCollection | undefined;

  return {

    init(_pmNode, editor) {
      findDecorations = editor.createDecorationsCollection();
    },

    pmUpdate(_prevNode, updateNode, editor) {

      const model = editor.getModel();
      if (!model || !findDecorations) {
        return;
      }

      // get the find decorations
      const findMarkers: monaco.editor.IModelDeltaDecoration[] = [];
      const decorations = context.pmContext.find.decorations();
      const pos = getPos();
      if (decorations && pos !== undefined) {
        const decos = decorations.find(pos, pos + updateNode.nodeSize - 1);
        decos.forEach((deco) => {
          if (deco.from !== view.state.selection.from && deco.to !== view.state.selection.to) {
            findMarkers.push({
              range: monaco.Range.fromPositions(
                model.getPositionAt(deco.from - pos - 1),
                model.getPositionAt(deco.to - pos - 1)
              ),
              options: { inlineClassName: "pm-find-text" }
            });
          } else {
            // ensure that the selection is visible
            scrollLineIntoView(editor, model.getPositionAt(deco.from - pos - 1), context);
          }
        });
      }

      findDecorations.set(findMarkers);
    },

    cleanup() {
      findDecorations?.clear();
    }
  };
}

// scroll the outer (prosemirror) scroll container so that the given position
// within the editor is visible. scrollCodeViewElementIntoView wants an element
// positioned relative to the code view dom, so we hand it the line's box.
function scrollLineIntoView(editor: CodeEditor, position: monaco.Position, context: BehaviorContext) {
  const visible = editor.getScrolledVisiblePosition(position);
  if (visible) {
    const lineBox = { offsetTop: visible.top, offsetHeight: visible.height } as HTMLElement;
    scrollCodeViewElementIntoView(lineBox, context.dom, context.view);
  }
}
