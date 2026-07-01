/*
 * diagram.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


import debounce from "lodash.debounce";

import { codeViewActiveBlockContext } from "editor";
import { languageDiagramEngine } from "editor-core";
import { Behavior, BehaviorContext } from ".";

export function diagramBehavior(context: BehaviorContext) : Behavior {

  const onDiagramCodeChanged = debounce(() => {
    previewDiagram(context, false);
  }, 500);

  return {
    cmUpdate(tr, _cmView, pmNode) {
      if (tr.docChanged) {
        const nodeLang = context.options.lang(pmNode, pmNode.textContent) || "";
        const engine = languageDiagramEngine(nodeLang);
        if (engine) {
          onDiagramCodeChanged();
        }
      }
    },
  }
}

export function previewDiagram(context: BehaviorContext, activate: boolean) {
  const ctx = codeViewActiveBlockContext(context.view.state);
  if (ctx) {
    const engine = languageDiagramEngine(ctx.activeLanguage);
    if (engine) {
      const activeBlock = ctx.blocks.find((block) => block.active);
      if (activeBlock) {
        context.pmContext.ui.codeview?.codeViewPreviewDiagram({
            engine,
            src: activeBlock.code,
          },
          activate
        );
      }
    }
  }
}