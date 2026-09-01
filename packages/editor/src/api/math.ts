/*
 * math.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorState } from 'prosemirror-state';

import { EditorMath, EditorUIMath } from './ui-types';
import { PandocToken } from './pandoc';
import { markIsActive, getMarkAttrs } from './mark';

export const kMathType = 0;
export const kMathContent = 1;

// additional field we stick into the AST for quarto crossref ids
export const kMathId = 2;

export enum MathType {
  Inline = 'InlineMath',
  Display = 'DisplayMath',
}

export function editorMath(uiMath: EditorUIMath): EditorMath {
  // return a promise that will typeset this node's math (including retrying as long as is
  // required if the element is not yet connected to the DOM)
  return {
    typeset: (el: HTMLElement, math: string, priority: boolean): Promise<boolean> => {
      return new Promise(resolve => {
        // regular typeset if we are already connected
        if (el.isConnected) {
          uiMath.typeset(el, math, priority).then(resolve);
        } else {
          // otherwise wait 100ms then retry
          const timerId = window.setInterval(() => {
            if (el.isConnected) {
              clearInterval(timerId);
              uiMath.typeset(el, math, priority).then(resolve);
            }
          }, 100);
        }
      });
    },
  };
}

export function delimiterForType(type: string) {
  if (type === MathType.Inline) {
    return '$';
  } else {
    return '$$';
  }
}

export function stringifyMath(tok: PandocToken) {
  const delimter = delimiterForType(tok.c[kMathType].t);
  return delimter + tok.c[kMathContent] + delimter;
}

export function mathTypeIsActive(state: EditorState, type: MathType) {
  const schema = state.schema;
  return (
    markIsActive(state, schema.marks.math) &&
    getMarkAttrs(state.doc, state.selection, schema.marks.math).type === type
  );
}

