/*
 * find.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Compartment, Range, RangeSet } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { scrollCodeViewElementIntoView } from "editor";

import { Behavior, BehaviorContext } from ".";

export function findBehavior(context: BehaviorContext) : Behavior {

    const { view, getPos } = context;  

    const findDecoratorMark = Decoration.mark({class: "pm-find-text"})
    const findDecorators = new Compartment();
  
    return {
      extensions: [findDecorators.of([])],

      pmUpdate(_prevNode, updateNode, cmView) {
      
        // get the find decorations
        const findMarkers: Range<Decoration>[] = [];
        const decorations = context.pmContext.find.decorations();      
        if (decorations && typeof getPos === "function") {
          const decos = decorations?.find(getPos(), getPos() + updateNode.nodeSize - 1);
          if (decos) {
            decos.forEach((deco) => {
              if (deco.from !== view.state.selection.from && deco.to !== view.state.selection.to) {
                findMarkers.push(findDecoratorMark.range(deco.from - getPos() - 1, deco.to - getPos() -1));
              } else {
                // ensure that the selection is visible
                const domElement = cmView.domAtPos(deco.from);
                const el = domElement.node instanceof HTMLElement ? domElement.node : domElement.node.parentElement;
                if (el) {
                  scrollCodeViewElementIntoView(el, context.dom, context.view);
                }
              }
            })
          }
        }

        const ranges = RangeSet.of<Decoration>(findMarkers);
        cmView.dispatch({
          effects: findDecorators.reconfigure(EditorView.decorations.of(ranges))
        });
      },
    }
}