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


import { DispatchEvent } from "editor";
import { Transaction } from "prosemirror-state";
import { Behavior, BehaviorContext } from ".";
import { asCodeMirrorSelection } from "./trackselection";

export function toolbarBehavior(context: BehaviorContext) : Behavior {
  
  let unsubscibe: VoidFunction;

  let activeToolbar: HTMLElement | undefined;
  
  
  return {
    init(pmView, cmView) {

      unsubscibe = context.pmContext.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
        // track selection-only changes
        if (tr && tr.selectionSet && !tr.docChanged) {
          const cmSelection = asCodeMirrorSelection(context.view, cmView, context.getPos);
          if (cmSelection) {
            if (!activeToolbar) {
              const nodeLang = context.options.lang(pmView, pmView.textContent);
              if (nodeLang) {
                if (!context.pmContext.ui.context.executableLanguges?.().includes(nodeLang)) {
                  return;
                }
              }
                  
              // add widgets
              // https://microsoft.github.io/vscode-codicons/dist/codicon.html
              activeToolbar = document.createElement("div");
              activeToolbar.classList.add("pm-codemirror-toolbar");

              const addButton = (...classes: string[]) => {
                const button = document.createElement("i");
                button.classList.add("codicon", ...classes);
                activeToolbar!.appendChild(button);
              }

              
              addButton("codicon-run-above", "pm-codeview-run-other-button");
              addButton("codicon-run-below", "pm-codeview-run-other-button");
              addButton("codicon-play", "pm-codeview-run-button");

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
      unsubscibe?.();
    },
    extensions: []
  }
}
