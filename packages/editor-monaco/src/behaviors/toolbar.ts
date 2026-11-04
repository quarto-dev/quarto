/*
 * toolbar.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Transaction } from "prosemirror-state";

import { languageDiagramEngine } from "editor-core";

import { CodeViewActiveBlockContext, codeViewActiveBlockContext, CodeViewExecute, DispatchEvent } from "editor";

import { Behavior, BehaviorContext } from ".";
import { previewDiagram } from "./diagram";
import { asEditorSelection } from "./trackselection";

export function toolbarBehavior(context: BehaviorContext): Behavior {

  let unsubscribe: VoidFunction;
  let toolbar: HTMLElement | undefined;

  const showToolbar = (show: boolean) => {
    if (show && !toolbar) {
      toolbar = createToolbarPanel();
      context.dom.appendChild(toolbar);
    } else if (!show && toolbar) {
      toolbar.remove();
      toolbar = undefined;
    }
  };

  function createToolbarPanel() {

    // get context
    const cvContext = codeViewActiveBlockContext(context.view.state)!;

    // create toolbar
    const panel = document.createElement("div");
    panel.classList.add("pm-monaco-toolbar");

    // add a button
    const addButton = (title: string, onClick: VoidFunction, ...classes: string[]) => {
      const button = document.createElement("i");
      button.title = title;
      button.classList.add("codicon", ...classes);
      button.addEventListener('mousedown', (ev) => {
        // don't steal focus from the editor
        ev.preventDefault();
      });
      button.addEventListener('click', (ev) => {
        onClick();
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      });
      panel.appendChild(button);
      return button;
    };

    const addExecuteButton = (execute: CodeViewExecute, title: string, ...classes: string[]) => {
      addButton(title, () => {
        context.pmContext.ui.codeview?.codeViewExecute(execute, cvContext);
      }, ...classes);
    };

    // buttons (conditional on context)
    const t = context.pmContext.ui.context.translateText;
    const diagramEngine = languageDiagramEngine(cvContext.activeLanguage);
    if (diagramEngine) {
      addButton(t("Preview Diagram"), () => {
        previewDiagram(context, true);
      }, "codicon-zoom-in", "pm-codeview-run-button");
    } else {
      if (runnableCellsAbove(cvContext)) {
        addExecuteButton("above", t("Run Cells Above"), "codicon-run-above", "pm-codeview-run-other-button");
      }
      if (runnableCellsBelow(cvContext)) {
        addExecuteButton("below", t("Run Cells Below"), "codicon-run-below", "pm-codeview-run-other-button");
      }
      addExecuteButton("cell", t("Run Cell"), "codicon-play", "pm-codeview-run-button");
    }

    return panel;
  }

  return {
    init(pmNode, editor) {
      unsubscribe = context.pmContext.events.subscribe(DispatchEvent, (tr: Transaction | undefined) => {
        // track selection-only changes
        if (tr && tr.selectionSet && !tr.docChanged) {
          const selection = asEditorSelection(context.view, editor, context.getPos);
          if (selection) {
            const nodeLang = context.options.lang(pmNode, pmNode.textContent);
            const cvContext = codeViewActiveBlockContext(context.view.state);
            const show = !!cvContext && !!nodeLang &&
              // is an executable language
              (!!context.pmContext.ui.context.executableLanguges?.().includes(nodeLang) ||
                // or is a diagram language
                !!languageDiagramEngine(nodeLang));
            // rebuild so the above/below buttons reflect the current document
            showToolbar(false);
            showToolbar(show);
          } else {
            showToolbar(false);
          }
        }
      });
    },
    cleanup: () => {
      unsubscribe?.();
      showToolbar(false);
    },
  };
}

function runnableCellsAbove(context: CodeViewActiveBlockContext) {
  const activeIndex = context.blocks.findIndex(block => block.active);
  if (activeIndex !== -1) {
    for (let i = 0; i < activeIndex; i++) {
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
    for (let i = (activeIndex + 1); i < context.blocks.length; i++) {
      if (context.blocks[i]?.language === context.activeLanguage) {
        return true;
      }
    }
  }
  return false;
}
