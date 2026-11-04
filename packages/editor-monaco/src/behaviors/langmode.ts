/*
 * langmode.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';

import { monaco } from "../monaco";
import { initTextMate } from "../textmate";
import { monacoLanguageId } from '../languages';

import { Behavior, BehaviorContext, CodeEditor } from '.';

export function langModeBehavior(context: BehaviorContext): Behavior {

  let disposed = false;

  const nodeLang = (nd: ProsemirrorNode) => context.options.lang(nd, nd.textContent) || '';

  const setMode = (lang: string, editor: CodeEditor) => {
    // languages are registered once the host has provided them
    initTextMate(context.pmContext.ui.codeview).then(() => {
      const model = editor.getModel();
      if (!disposed && model) {
        monaco.editor.setModelLanguage(model, monacoLanguageId(lang));
      }
    });
  };

  return {
    init: (pmNode, editor) => {
      setMode(nodeLang(pmNode), editor);
    },
    pmUpdate: (prevNode, updateNode, editor) => {
      const updateLang = nodeLang(updateNode);
      if (nodeLang(prevNode) !== updateLang) {
        setMode(updateLang, editor);
      }
    },
    cleanup: () => {
      disposed = true;
    }
  };
}
