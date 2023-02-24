/*
 * toolbar.ts
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


import { CodeViewActiveBlockContext, codeViewActiveBlockContext, CodeViewExecute, DispatchEvent } from "editor";
import { Transaction } from "prosemirror-state";
import { Behavior, BehaviorContext } from ".";
import { asCodeMirrorSelection } from "./trackselection";

export function toolbarBehavior(context: BehaviorContext) : Behavior {
  
  let unsubscribe: VoidFunction;

  let activeToolbar: HTMLElement | undefined;
  
  return {
    init(pmView, cmView) {

      unsubscribe = context.pmContext.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
        // track selection-only changes
        if (tr && tr.selectionSet && !tr.docChanged) {
          const cmSelection = asCodeMirrorSelection(context.view, cmView, context.getPos);
          if (cmSelection) {
            if (!activeToolbar) {
              // verify this is an executable language
              const nodeLang = context.options.lang(pmView, pmView.textContent);
              if (nodeLang) {
                if (!context.pmContext.ui.context.executableLanguges?.().includes(nodeLang)) {
                  return;
                }
              }

              // get context
              const cvContext = codeViewActiveBlockContext(context.view.state);
              if (!cvContext) {
                return;
              }
                  
              // create toolbar
              activeToolbar = document.createElement("div");
              activeToolbar.classList.add("pm-codemirror-toolbar");

              // add an execute button
              const addButton = (execute: CodeViewExecute, ...classes: string[]) => {
                const button = document.createElement("i");
                button.classList.add("codicon", ...classes);
                button.addEventListener('click', (ev) => {
                  context.pmContext.ui.codeview?.codeViewExecute(execute, cvContext);
                  ev.preventDefault();
                  ev.stopPropagation();
                  return false;
                });
                activeToolbar!.appendChild(button);
                return button;
              }
              
              // buttons (conditional on context)
              if (runnableCellsAbove(cvContext)) {
                addButton("above", "codicon-run-above", "pm-codeview-run-other-button");
              }
              if (runnableCellsBelow(cvContext)) {
                addButton("below", "codicon-run-below", "pm-codeview-run-other-button");
              }
              addButton("cell", "codicon-play", "pm-codeview-run-button");
               
              // append toolbar
              context.dom.appendChild(activeToolbar);
            }
          } else {
            if (activeToolbar) {
              activeToolbar.parentElement?.removeChild(activeToolbar);
              activeToolbar = undefined;
            }
          }
        }
      });
    },
    cleanup: () => {
      unsubscribe?.();
    },
    extensions: []
  }
}

function runnableCellsAbove(context: CodeViewActiveBlockContext) {
  const activeIndex = context.blocks.findIndex(block => block.active);
  if (activeIndex !== -1) {
    for (let i=0; i<activeIndex; i++) {
      if (context.blocks[i].language === context.activeLanguage) {
        return true;
      }
    }
  } 
  return false;
}

function runnableCellsBelow(context: CodeViewActiveBlockContext) {
  const activeIndex = context.blocks.findIndex(block => block.active);
  if (activeIndex !== -1) {
    for (let i=(activeIndex+1); i<context.blocks.length; i++) {
      if (context.blocks[i]?.language === context.activeLanguage) {
        return true;
      }
    }
  } 
  return false;
}
