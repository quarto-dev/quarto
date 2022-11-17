/*
 * codemirror.ts
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

import {
  Plugin,
  PluginKey
} from 'prosemirror-state';

import { Node as ProsemirrorNode } from 'prosemirror-model';
import { EditorView, NodeView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';


import { ExtensionContext, ExtensionFn } from "../../api/extension";
import { CodeViewOptions } from '../../api/extension-types';


const plugin = new PluginKey('codemirror');


export function codemirrorExtension(codeViews: { [key: string]: CodeViewOptions }): ExtensionFn {

  return (context: ExtensionContext) => {
   
    // build nodeViews
    const nodeTypes = Object.keys(codeViews);
    const nodeViews: {
      [name: string]: (node: ProsemirrorNode, view: EditorView, getPos: boolean | (() => number)) => NodeView;
    } = {};
    /*
    nodeTypes.forEach(name => {
      nodeViews[name] = (node: ProsemirrorNode, view: EditorView, getPos: boolean | (() => number)) => {
        // TODO: return node view
        
      };
    });
    */

   
    return {
      plugins: () => [
        new Plugin({
          key: plugin,
          props: {
            nodeViews,
            handleDOMEvents: {
              
            },
          },
        }),
        keymap({
          
        }),
      ],
      commands: () => [
       
      ]
    };
  };
}