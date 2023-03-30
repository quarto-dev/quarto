/*
 * plain_text_paste.ts
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

import { isWindows } from 'core-browser';
import { ResolvedPos, Schema, Fragment, Slice, Node as ProsemirrorNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

import { Extension } from '../api/extension';
import { mapFragment } from '../api/fragment';

const extension: Extension = {
  plugins: (schema: Schema) => [
    pasteTextPlugin(schema),
    pasteWordPlugin(schema)
  ],
};

function pasteTextPlugin(schema: Schema) {
  return new Plugin({
    key: new PluginKey('paste-text'),

    props: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clipboardTextParser: (text: string, $context: ResolvedPos) : any => {
        // if it's a single line then create a slice w/ marks from the context active
        if (text.indexOf('\n') === -1) {
          const marks = $context.marks();
          const textNode = schema.text(text, marks);
          return new Slice(Fragment.from(textNode), 0, 0);
        } else {
          return null;
        }
      },
    },
  });
}

function pasteWordPlugin(schema: Schema) {

  return new Plugin({

    key: new PluginKey('paste-word'),

    props: {

      handlePaste: (view: EditorView, event: ClipboardEvent, slice: Slice) : boolean | void => {

        if (event.clipboardData) {

          // if this contains office content or we are on windows then handle it
          // (office content has excessive internal vertical space, windows has
          // issues w/ prosemirror freezing in its paste implementation when handling
          // multiple paragraphs)
          const kTextHtml = "text/html";
          const kWordSchema = "urn:schemas-microsoft-com:office:word";
          if (event.clipboardData.types.includes(kTextHtml)) {
            const html = event.clipboardData.getData(kTextHtml);
            if (html.includes(kWordSchema) || isWindows()) {
              // filter out nodes with empty paragraphs
              const nodes: ProsemirrorNode[] = [];
              for (let i = 0; i < slice.content.childCount; i++) {
                const node = slice.content.child(i)
                if (node.textContent.trim() !== "") {
                  const newNode = node.type.createAndFill(node.attrs, mapFragment(node.content, nd => {
                    if (nd.isText) {
                      return schema.text(nd.text!.replace(/\n/g, ' '), nd.marks);
                    } else {
                      return nd;
                    }
                  }), node.marks);
                  nodes.push(newNode || node);
                }
              }
              const fragment = Fragment.fromArray(nodes);
              const newSlice = new Slice(fragment, slice.openStart, slice.openEnd);
              view.dispatch(view.state.tr.replaceSelection(newSlice));
              return true;
            }
          }
        }

        return false;
      }  
    },
  });
}


export default extension;
