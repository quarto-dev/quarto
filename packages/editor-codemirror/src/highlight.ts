/*
 * highlight.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
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

import { highlightTree, Highlighter } from "@lezer/highlight";
import { Language, defaultHighlightStyle } from '@codemirror/language';

import { languageLoaders } from "./languages";

export type HighlightCallback = (text: string, style: string | null, from: number, to: number) => void;

export function highlightCode(
  code: string, 
  language: Language, 
  style: Highlighter,
  callback: HighlightCallback)
{
  const tree = language.parser.parse(code);
  let pos = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlightTree(tree as any, style, (from, to, classes) => {
    from > pos && callback(code.slice(pos, from), null, pos, from);
    callback(code.slice(from, to), classes, from, to);
    pos = to;
  });
  pos != tree.length && callback(code.slice(pos, tree.length), null, pos, tree.length);
}

export function highlightDemo() {
  languageLoaders["javascript"]().then(jsLang => {
    highlightCode(
      "function(x) { return x + 1; }", 
      jsLang.language,
      defaultHighlightStyle,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (content, classes, _from, _to) => {
        const span = document.createElement('span');
        if (classes) {
          span.classList.add(...classes.split(' '));
        }
        span.innerText = content;
        console.log(span);
      }
    )
  });
}

