/*
* hooks.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { Hook } from "../types";
import { Mode } from '@jupyterlab/codemirror';

export function codeMirrorPreloadHook(): Hook<string, string> {
  // TODO: Properly deal with {r}, {{r}} style expressions
  const fenced = new RegExp(/^`{3}([^\s]+)/g);

  return {
    run: async source => {
      const newModes = new Map<string, Promise<any>>();
      let match: RegExpMatchArray | null;
      while ((match = fenced.exec(source))) {
        if (!newModes.has(match[1])) {
          newModes.set(match[1], Mode.ensure(match[1]));
        }
      }
      if (newModes.size) {
        Promise.all(newModes.values()).catch(console.warn);
      }
      return source;
    }
  };
}

export const codeMirrorHighlight = (str: string, lang: string) => {
  if (!lang) {
    return ''; // use external default escaping
  }
  try {
    const spec = Mode.findBest(lang);
    if (!spec) {
      console.warn(`No CodeMirror mode: ${lang}`);
      return '';
    }

    const el = document.createElement('div');
    try {
      Mode.run(str, spec.mime, el);
      return el.innerHTML;
    } catch (err) {
      console.warn(`Failed to highlight ${lang} code`, err);
    }
  } catch (err) {
    console.warn(`No CodeMirror mode: ${lang}`);
    console.warn(`Require CodeMirror mode error: ${err}`);
  }
  return '';
};
