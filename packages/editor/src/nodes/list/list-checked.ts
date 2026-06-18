/*
 * list-checked.ts
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

import { Node as ProsemirrorNode, Schema, Fragment, NodeType } from 'prosemirror-model';
import { NodeView, EditorView } from 'prosemirror-view';
import { EditorState, Transaction } from 'prosemirror-state';
import { findParentNodeOfType, NodeWithPos, setTextSelection } from 'prosemirror-utils';
import { InputRule, wrappingInputRule } from 'prosemirror-inputrules';

import { ProsemirrorCommand, EditorCommandId } from '../../api/command';
import { PandocToken } from '../../api/pandoc';

// custom NodeView that accomodates display / interaction with item check boxes
export class CheckedListItemNodeView implements NodeView {
  public readonly dom: HTMLElement;
  public readonly contentDOM: HTMLElement;

  constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number) {

    // create root li element
    this.dom = window.document.createElement('li');
    if (node.attrs.tight) {
      this.dom.setAttribute('data-tight', 'true');
    }

    const container = window.document.createElement('div');
    container.classList.add('list-item-container');
    this.dom.appendChild(container);

    // add checkbox for checked items
    if (node.attrs.checked !== null) {
      this.dom.setAttribute('data-checked', node.attrs.checked ? 'true' : 'false');

      // checkbox for editing checked state
      const input = window.document.createElement('input');
      input.classList.add('list-item-checkbox');
      input.setAttribute('type', 'checkbox');
      input.checked = node.attrs.checked;
      input.contentEditable = 'false';
      input.disabled = !view.editable;
      input.addEventListener('mousedown', (ev: Event) => {
        ev.preventDefault(); // don't steal focus
      });
      input.addEventListener('change', (ev: Event) => {
        const tr = view.state.tr;
        tr.setNodeMarkup(getPos(), node.type, {
          ...node.attrs,
          checked: (ev.target as HTMLInputElement).checked,
        });
        setTextSelection(getPos() + 1)(tr);
        view.dispatch(tr);
      });
      container.appendChild(input);
    }

    // content div
    const content = window.document.createElement('div');
    content.classList.add('list-item-content');
    this.contentDOM = content;
    container.appendChild(content);
  }
}

// command to toggle checked list items
export function checkedListItemCommandFn(itemType: NodeType) {
  return (state: EditorState, dispatch?: ((tr: Transaction) => void) | undefined) => {
    const itemNode = findParentNodeOfType(itemType)(state.selection);
    if (!itemNode) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      if (itemNode.node.attrs.checked !== null) {
        setItemChecked(tr, itemNode, null);
      } else {
        setItemChecked(tr, itemNode, false);
      }

      dispatch(tr);
    }

    return true;
  };
}

export function checkedListItemToggleCommandFn(itemType: NodeType) {
  return (state: EditorState, dispatch?: ((tr: Transaction) => void) | undefined) => {
    const itemNode = findParentNodeOfType(itemType)(state.selection);
    if (!itemNode || itemNode.node.attrs.checked === null) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr;
      setItemChecked(tr, itemNode, !itemNode.node.attrs.checked);
      dispatch(tr);
    }

    return true;
  };
}

export class CheckedListItemCommand extends ProsemirrorCommand {
  constructor(itemType: NodeType) {
    super(EditorCommandId.ListItemCheck, [], checkedListItemCommandFn(itemType));
  }

  public isActive(state: EditorState): boolean {
    if (this.isEnabled(state)) {
      const itemNode = findParentNodeOfType(state.schema.nodes.list_item)(state.selection) as NodeWithPos;
      return itemNode.node.attrs.checked !== null;
    } else {
      return false;
    }
  }
}

export class CheckedListItemToggleCommand extends ProsemirrorCommand {
  private itemType: NodeType;

  constructor(itemType: NodeType) {
    super(EditorCommandId.ListItemCheckToggle, [], checkedListItemToggleCommandFn(itemType));
    this.itemType = itemType;
  }

  public isActive(state: EditorState): boolean {
    const itemNode = findParentNodeOfType(this.itemType)(state.selection);
    return itemNode && itemNode.node.attrs.checked;
  }
}

// allow users to type [x] or [ ] to define a checked list item
export function checkedListItemInputRule() {
  return new InputRule(/\[([ x])\]\s$/, (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
    const schema = state.schema;

    const itemNode = findParentNodeOfType(schema.nodes.list_item)(state.selection);
    if (itemNode) {
      // create transaction
      const tr = state.tr;

      // set checked
      setItemChecked(tr, itemNode, match[1]);

      // delete entered text
      tr.delete(start, end);

      // return transaction
      return tr;
    } else {
      return null;
    }
  });
}

export interface InputRuleWithHandler extends InputRule {
  handler: (state: EditorState, match: RegExpMatchArray, start: number, end: number) => Transaction;
}

// allow users to begin a new checked list by typing [x] or [ ] at the beginning of a line
export function checkedListInputRule(schema: Schema) {
  // regex to match checked list at the beginning of a line
  const regex = /^\s*\[([ x])\]\s$/;

  // we are going to steal the handler from the base bullet list wrapping input rule
  const baseInputRule = wrappingInputRule(regex, schema.nodes.bullet_list) as InputRuleWithHandler;

  return new InputRule(regex, (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
    // call the base handler to create the bullet list
    const tr = baseInputRule.handler(state, match, start, end);
    if (tr) {
      // set the checkbox
      const itemNode = findParentNodeOfType(schema.nodes.list_item)(tr.selection);
      if (itemNode) {
        setItemChecked(tr, itemNode, match[1]);
      }

      return tr;
    } else {
      return null;
    }
  });
}

function setItemChecked(tr: Transaction, itemNode: NodeWithPos, check: null | boolean | string) {
  tr.setNodeMarkup(itemNode.pos, itemNode.node.type, {
    ...itemNode.node.attrs,
    checked: check === null ? null : typeof check === 'string' ? check === 'x' : check,
  });
}
// prepend a check mark to the provided fragment
export function fragmentWithCheck(schema: Schema, fragment: Fragment, checked: boolean) {
  // create a raw markdown node with [x] or [ ]
  const mark = schema.marks.raw_inline.create({ format: 'markdown' });
  const check = schema.text((checked ? '[x]' : '[ ]') + ' ', [mark]);
  return Fragment.from(check).append(fragment);
}

const kCheckedChar = '☒';
const kUncheckedChar = '☐';

/**
 * example of `tokens`:
 * ```json
 * {t:"Para",c:[{t:"Str",c:"☒"},{t:"Space"},{t:"Str",c:"example"}]}
 * ```
 *
 * this function takes that and returns:
 *
 * ```json
 * {
 *   checked: true,
 *   tokens: {t:"Para",c:[{t:"Str",c:""},{t:"Space"},{t:"Str",c:"example"}]},
 * }
 * ```
 *
 * notice that the `☒` character was removed from the first "Str" node.
 */
export function tokensWithChecked(tokens: PandocToken[]): { checked: null | boolean; tokens: PandocToken[]; } {
  const checkNode = tokens[0]?.c?.[0];
  const checkChar = checkNode?.t === 'Str' ? checkNode.c.charAt(0) : '';
  const checked = checkChar === kCheckedChar ?
    true : checkChar === kUncheckedChar
      ? false :
      null;

  const modifiedTokens = structuredClone(tokens);
  // if checked, then strip the `☒` or `☐` from the first node and remove the following space (if there is one)
  if (checked === true || checked === false) {
    if (modifiedTokens[0].c[1].t === 'Space') {
      modifiedTokens[0].c.splice(0, 2); // remove the first two tokens
    } else {
      modifiedTokens[0].c.splice(0, 1); // remove the first token
    }
  }

  return {
    checked,
    tokens: modifiedTokens,
  };
}
