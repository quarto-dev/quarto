/*
 * omni_insert.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */
import { Mark, Fragment, DOMOutputSpec } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';

import { PandocOutput } from '../../api/pandoc';
import { ProsemirrorCommand, EditorCommandId } from '../../api/command';
import { CompletionHandler, selectionAllowsCompletions } from '../../api/completion';
import { OmniInserter } from '../../api/omni_insert';
import { MarkInputRuleFilter } from '../../api/input_rule';
import { EditorUI } from '../../api/ui-types';

import { omniInsertCompletionHandler } from './omni_insert-completion';
import { Extension } from '../../api/extension';
import { markIsActive } from '../../api/mark';

export function markOmniInsert() {
  return {
    marks: [
      {
        name: 'omni_insert',
        spec: {
          inclusive: true,
          noInputRules: true,
          parseDOM: [{ tag: "span[class*='omni_insert']" }],
          toDOM() : DOMOutputSpec {
            return ['span', { class: 'omni_insert' }];
          },
        },
        pandoc: {
          readers: [],
          writer: {
            priority: 30,
            write: (output: PandocOutput, _mark: Mark, parent: Fragment) => {
              output.writeInlines(parent);
            },
          },
        },
      },
    ],
  };
}

export function omniInsertExtension(
  omniInserters: OmniInserter[],
  inputRuleFilter: MarkInputRuleFilter,
  ui: EditorUI,
): Extension {
  return {
    commands: () => [new OmniInsertCommand(inputRuleFilter)],
    completionHandlers: () : CompletionHandler<OmniInserter>[] => [omniInsertCompletionHandler(omniInserters, ui)],
  };
}

class OmniInsertCommand extends ProsemirrorCommand {
  constructor(markFilter: MarkInputRuleFilter) {
    super(
      EditorCommandId.OmniInsert,
      ['Mod-/'],
      (state: EditorState, dispatch?: (tr: Transaction) => void) => {
        // check whether selection allows completions
        if (!selectionAllowsCompletions(state.selection)) {
          return false;
        }

        // if the marks is already active then bail
        if (markIsActive(state, state.schema.marks.omni_insert)) {
          return false;
        }

        // check the mark filter
        if (!markFilter(state)) {
          return false;
        }

        if (dispatch) {
          const mark = state.schema.marks.omni_insert.create();
          const node = state.schema.text('/', [mark]);
          const tr = state.tr;
          tr.replaceSelectionWith(node, false);
          dispatch(tr);
        }

        return true;
      },
    );
  }
}
