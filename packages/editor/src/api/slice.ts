/*
 * slice.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Slice, Node as ProsemirrorNode } from 'prosemirror-model';
import { mapFragment } from './fragment';

export function sliceContentLength(slice: Slice) {
  let length = 0;
  for (let i = 0; i < slice.content.childCount; i++) {
    length += slice.content.child(i).textContent.length;
  }
  return length;
}

export function sliceHasNode(slice: Slice, predicate: (node: ProsemirrorNode) => boolean) {
  let hasNode = false;
  slice.content.descendants(node => {
    if (predicate(node)) {
      hasNode = true;
      return false;
    } else {
      return true;
    }
  });
  return hasNode;
}


export const mapSlice = (
  slice: Slice,
  map: (node: ProsemirrorNode) => ProsemirrorNode | null
): Slice => {
  const fragment = mapFragment(slice.content, map);
  return new Slice(fragment, slice.openStart, slice.openEnd);
};
