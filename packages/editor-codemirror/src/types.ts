/*
 * types.ts
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



import { EditorState, Transaction } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { LanguageSupport } from "@codemirror/language";

export type LanguageLoaders = Record<string, () => Promise<LanguageSupport>>;
import { Extension } from "@codemirror/state";

export type CodeBlockSettings = {
  createSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: (() => number) | boolean
  ) => () => void;
  updateSelect: (
    settings: CodeBlockSettings,
    dom: HTMLElement,
    node: Node,
    view: EditorView,
    getPos: (() => number) | boolean,
    oldNode: Node
  ) => void;
  stopEvent: (
    e: Event,
    node: Node,
    getPos: (() => number) | boolean,
    view: EditorView,
    dom: HTMLElement
  ) => boolean;
  languageLoaders?: LanguageLoaders;
  languageNameMap?: Record<string, string>;
  languageWhitelist?: string[];
  undo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  redo?: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
  theme?: Extension[];
  readOnly: boolean;
};
