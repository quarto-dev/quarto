/*
 * dom.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { EditorView } from 'prosemirror-view';

export function bodyElement(view: EditorView): HTMLElement {
  return view.dom.firstChild as HTMLElement;
}

export function isElementVisible(el: HTMLElement) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

export function elementInnerDimensions(el: HTMLElement) {
  const cs = getComputedStyle(el);

  const asNumber = (x: string | null) => (x ? parseFloat(x) : 0);
  const paddingX = asNumber(cs.paddingLeft) + asNumber(cs.paddingRight);
  const paddingY = asNumber(cs.paddingTop) + asNumber(cs.paddingBottom);
  const borderX = asNumber(cs.borderLeftWidth) + asNumber(cs.borderRightWidth);
  const borderY = asNumber(cs.borderTopWidth) + asNumber(cs.borderBottomWidth);

  return {
    width: el.offsetWidth - paddingX - borderX,
    height: el.offsetHeight - paddingY - borderY,
  };
}

export function onElementRemoved(container: Node, el: HTMLElement, onRemoved: VoidFunction) {
  const observer = new MutationObserver(mutationsList => {
    mutationsList.forEach(mutation => {
      mutation.removedNodes.forEach(node => {
        if (node === el) {
          onRemoved();
        }
      });
    });
  });
  observer.observe(container, { attributes: false, childList: true, subtree: true });
}



// Receive a callback when the given node is attached to the given document.
export function onNodeAttached(node: Node, doc: Document,
  callback: (node: Node, parentNode: Node) => void) {

  const obs = new MutationObserver(mutations => {
    for (const mut of mutations) {
      mut.addedNodes.forEach(x => {
        if (x === node) {
          obs.disconnect();
          callback(node, mut.target);
          return;
        }
      });
    }
  });

  obs.observe(doc, {
    childList: true,
    subtree: true
  });

  return obs;
}
