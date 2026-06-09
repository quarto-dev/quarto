/*
 * word_count.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import { Plugin, PluginKey, EditorState, Transaction, EditorStateConfig } from 'prosemirror-state';
import { Schema, Node as ProsemirrorNode } from 'prosemirror-model';
import { DecorationSet, Decoration } from 'prosemirror-view';

import { findChildrenByType } from 'prosemirror-utils';

import { wordBreaker } from 'core';

import { Extension, ExtensionContext } from '../api/extension';
import { EditorUIPrefs } from '../api/ui-types';
import { findTopLevelBodyNodes } from '../api/node';
import { kSetMarkdownTransaction, kThemeChangedTransaction } from '../api/transaction';

import './word_count.css';

// node types whose text is code/raw rather than prose
const kExcludedNodeTypes = ['rmd_chunk', 'code_block', 'raw_block', 'yaml_metadata'];

const wb = wordBreaker();

const extension = (context: ExtensionContext): Extension => {
  const { ui } = context;

  return {
    plugins: (schema: Schema) => {
      return [wordCountPlugin(schema, ui.prefs)];
    },
  };
};

function wordCountPlugin(schema: Schema, prefs: EditorUIPrefs) {
  const key = new PluginKey<DecorationSet>('word-count');

  function decorationsForDoc(state: EditorState): DecorationSet {
    if (!prefs.showWordCount()) {
      return DecorationSet.empty;
    }

    const includeCode = prefs.wordCountIncludeCodeCells();

    // top-level headings in document order
    const headings = findTopLevelBodyNodes(state.doc, node => node.type === schema.nodes.heading);

    // sections are bounded by the body node (footnotes / annotations live in
    // sibling nodes after the body and should not be attributed to a section)
    const body = findChildrenByType(state.doc, schema.nodes.body, false)[0];
    const bodyEnd = body ? body.pos + body.node.nodeSize - 1 : state.doc.content.size;

    const decorations: Decoration[] = [];
    headings.forEach((heading, i) => {
      const level = heading.node.attrs.level as number;

      // section content runs from just after this heading to the next heading
      // of equal-or-higher level (or the end of the body)
      const from = heading.pos + heading.node.nodeSize;
      let to = bodyEnd;
      for (let j = i + 1; j < headings.length; j++) {
        if ((headings[j].node.attrs.level as number) <= level) {
          to = headings[j].pos;
          break;
        }
      }

      const words = countWords(state.doc, from, to, includeCode);
      decorations.push(
        Decoration.widget(heading.pos + 1, () => badgeElement(words), {
          key: `word-count-${words}`,
          side: -1,
          ignoreSelection: true,
          stopEvent: () => true,
        }),
      );
    });

    return DecorationSet.create(state.doc, decorations);
  }

  return new Plugin<DecorationSet>({
    key,

    state: {
      init(_config: EditorStateConfig, instance: EditorState) {
        return decorationsForDoc(instance);
      },

      apply(tr: Transaction, set: DecorationSet, _oldState: EditorState, newState: EditorState) {
        // rebuild on a full document replace, a theme/prefs change (the host
        // dispatches a theme-changed transaction whenever prefs are applied),
        // or any change to the document; otherwise just map positions
        if (tr.getMeta(kSetMarkdownTransaction) || tr.getMeta(kThemeChangedTransaction) || tr.docChanged) {
          return decorationsForDoc(newState);
        } else {
          return set.map(tr.mapping, tr.doc);
        }
      },
    },

    props: {
      decorations(state: EditorState) {
        return key.getState(state);
      },
    },
  });
}

// count prose words in [from, to), skipping code/raw nodes unless includeCode
function countWords(doc: ProsemirrorNode, from: number, to: number, includeCode: boolean): number {
  if (to <= from) {
    return 0;
  }
  let text = '';
  doc.nodesBetween(from, to, (node, pos) => {
    if (!includeCode && kExcludedNodeTypes.includes(node.type.name)) {
      return false; // don't descend into (or count) code/raw content
    }
    if (node.isText) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.nodeSize);
      text += node.text!.slice(start - pos, end - pos);
    } else if (node.type.name === 'hard_break') {
      text += ' '; // keep words separated across hard line breaks
    } else if (node.isBlock) {
      text += ' '; // keep words in adjacent blocks separate
    }
    return true;
  });
  return wb.breakWords(text).length;
}

function badgeElement(words: number): HTMLElement {
  const badge = window.document.createElement('span');
  badge.className = 'pm-word-count-badge pm-light-text-color';
  badge.contentEditable = 'false';
  badge.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  return badge;
}

export default extension;
