/*
 * index.ts
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

import { Plugin, PluginKey } from "prosemirror-state";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";
import { undo, redo } from "prosemirror-history";

import { ExtensionFn, CodeViewOptions } from "editor";
import { CodeBlockSettings } from "./types";
import { codeMirrorBlockNodeView } from "./node-view";
import { languageLoaders } from "./languages";

export const codeMirrorPluginKey = new PluginKey("codemirror");

export function codeMirrorExtension(
  codeViews: { [key: string]: CodeViewOptions })
: ExtensionFn {
  return () => {
    // build nodeViews
    const nodeTypes = Object.keys(codeViews);
    const nodeViews: {
      [name: string]: (
        node: ProsemirrorNode,
        view: EditorView,
        getPos: boolean | (() => number)
      ) => NodeView;
    } = {};
    const settings: CodeBlockSettings = {
      languageLoaders,
      undo, 
      redo
    };
    nodeTypes.forEach((name) => {
      nodeViews[name] = codeMirrorBlockNodeView(settings, codeViews[name]);
    });

    // return plugin
    return {
      plugins: () => [
        new Plugin({
          key: codeMirrorPluginKey,
          props: {
            nodeViews,
          },
        }),
      ]
    };
  };
}
