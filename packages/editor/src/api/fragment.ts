/*
 * fragment.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Fragment, Node as ProsemirrorNode } from 'prosemirror-model';

export function fragmentText(fragment: Fragment, unemoji = false) {
  let text = '';
  fragment.forEach(node => {
    const emjojiMark = node.marks.find(mark => mark.type === node.type.schema.marks.emoji);
    if (unemoji && emjojiMark) {
      return (text = text + (emjojiMark.attrs.emojihint || node.textContent));
    } else {
      return (text = text + node.textContent);
    }
  });
  return text;
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
