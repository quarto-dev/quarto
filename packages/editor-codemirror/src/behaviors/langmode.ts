/*
 * langmode.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Node as ProsemirrorNode } from 'prosemirror-model'

import { Compartment } from "@codemirror/state";
import { EditorView } from '@codemirror/view';

import { languageMode } from '../languages';

import { Behavior, BehaviorContext } from '.';

export function langModeBehavior(context: BehaviorContext) : Behavior {

  // compartment for dynamically reconfiguring the language
  const languageConf = new Compartment();

  // helper to get the language for a node
  const nodeLang = (nd: ProsemirrorNode) => context.options.lang(nd, nd.textContent) || '';

  // helper to set the current language node
  const setMode = (lang: string, cmView: EditorView) => {
    const support = languageMode(lang);
    if (support)
      cmView.dispatch({
        effects: languageConf.reconfigure(support),
      });
  };

  return {
    
    extensions: [languageConf.of([])],

    init: (pmNode: ProsemirrorNode, cmView: EditorView) => {
      const lang = nodeLang(pmNode);
      setMode(lang, cmView);
    },

    pmUpdate: (prevNode: ProsemirrorNode, updateNode: ProsemirrorNode, cmView: EditorView) => {
      const updateLang = nodeLang(updateNode);
      if (nodeLang(prevNode)!== updateLang)
        setMode(updateLang, cmView);
    }

  }

}
