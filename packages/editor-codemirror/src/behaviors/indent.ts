/*
 * indent.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { indentLess, indentMore } from "@codemirror/commands";

import { indentOnInput } from "@codemirror/language";
import { keymap } from "@codemirror/view";

import { Behavior } from ".";
import { acceptCompletion, completionStatus } from "@codemirror/autocomplete";

export function tabBehavior(): Behavior {
  return {
    extensions: [
      indentOnInput(),
      keymap.of([
        {
          key: 'Tab',
          preventDefault: true,
          shift: indentLess,
          run: e => {
            if (!completionStatus(e.state)) return indentMore(e);
            return acceptCompletion(e);
          },
        },
      ])
    ]
  };
}
