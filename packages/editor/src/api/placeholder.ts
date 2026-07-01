/*
 * placeholder.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Node as ProsemirrorNode, NodeType } from 'prosemirror-model';
import { EditorState, Transaction, Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';

import { findParentNode } from 'prosemirror-utils';

import { EditorUI } from './ui-types';

export function emptyNodePlaceholderPlugin(nodeType: NodeType, placeholder: (node: ProsemirrorNode) => string, filter?: (tr: Transaction) => boolean) {
  const pluginKey = new PluginKey(nodeType.name + '-empty-placeholder');

  return new Plugin<DecorationSet>({
    key: pluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr: Transaction) {
        // check for empty parent of our type
        const emptyNode = findParentNode(node => node.type === nodeType && node.childCount === 0)(tr.selection);
        if (emptyNode && (!filter || filter(tr))) {
          const decoration = placeholderDecoration(emptyNode.pos + 1, placeholder(emptyNode.node));
          return DecorationSet.create(tr.doc, [decoration]);
        } else {
          return DecorationSet.empty;
        }
      },
    },
    props: {
      decorations(state: EditorState) {
        return pluginKey.getState(state);
      },
    },
  });
}

export function placeholderDecoration(pos: number, text: string) {
  return Decoration.widget(pos, () => {
    const placeholder = window.document.createElement('span');
    placeholder.classList.add('pm-placeholder-text-color');
    placeholder.innerText = text;
    return placeholder;
  });
}

export function iconAndTextPlaceholderDecoration(pos: number, icon: string, text: string) {
  return Decoration.widget(pos, () => {
    const container = window.document.createElement('span');

    const iconImg = window.document.createElement('img');
    iconImg.classList.add('pm-placeholder-icon');
    iconImg.setAttribute('src', icon);
    iconImg.setAttribute('draggable', 'false');

    const message = window.document.createElement('span');
    message.classList.add('pm-placeholder-text-color');
    message.classList.add('pm-placeholder-text');
    message.innerText = text;

    container.appendChild(iconImg);
    container.appendChild(message);
    return container;
  });
}

export function searchPlaceholderDecoration(pos: number, ui: EditorUI, text?: string) {
  return iconAndTextPlaceholderDecoration(pos, ui.images.search!, text || '');
}
