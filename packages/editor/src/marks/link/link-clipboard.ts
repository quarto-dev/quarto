/*
 * link-clipboard.ts
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

import { Plugin, PluginKey } from 'prosemirror-state'
import {Schema, Slice, Fragment, Node as ProsemirrorNode, Attrs } from 'prosemirror-model';
import { markPasteHandler } from '../../api/clipboard';


export function linkPasteHandler(schema: Schema) {
  return markPasteHandler(/(?:<)?([a-z]+:\/\/[^\s>]+)(?:>)?/g, schema.marks.link, url => ({ href: url }));
}

export function linkCopyPlugin(schema: Schema) {

  return new Plugin({
    key: new PluginKey('link-copy'),
    props: { 
      transformCopied(slice: Slice) : Slice {
        const newSlice = mapSlice(slice, node => {
          if (node.isText) {
            const linkMark = node.marks.find(mark => mark.type === schema.marks.link);
            if (linkMark) {
              let marks = linkMark.removeFromSet(node.marks);
              const attrs = { ...linkMark.attrs, clipboardhref: linkMark.attrs.href };
              const newLinkMark = linkMark.type.create(attrs);
              marks = newLinkMark.addToSet(marks);
              return schema.text(node.textContent, marks);
            } else {
              return null;
            }
          } else {
            return null;
          }
        }); 
        return newSlice;
      }
     }
  });
}


export const mapFragment = (
  fragment: Fragment,
  map: (node: ProsemirrorNode) => ProsemirrorNode | null
): Fragment => {

  let mappedFragment = Fragment.from(fragment);
  fragment.forEach((node, _offset, index) => {
    const mappedNode = map(node);
    if (mappedNode !== null) {
      mappedFragment = mappedFragment.replaceChild(index, mappedNode);
    }
    node = mappedNode || node;
    if (node.content.childCount > 0) {
      mappedFragment = mappedFragment.replaceChild(
        index, 
        node.type.create(node.attrs, mapFragment(node.content, map))
      );
    }

  });
  return mappedFragment;
}

export const mapSlice = (
  slice: Slice,
  map: (node: ProsemirrorNode) => ProsemirrorNode | null
): Slice => {
  const fragment = mapFragment(slice.content, map);
  return new Slice(fragment, slice.openStart, slice.openEnd);
};
