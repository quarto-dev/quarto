/*
 * trailing_p.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Transaction } from 'prosemirror-state';
import { Extension } from '../api/extension';
import { FixupContext } from '../api/fixup';
import { requiresTrailingP, insertTrailingP } from '../api/trailing_p';

const extension: Extension = {
  fixups: () => {
    return [
      (tr: Transaction, context: FixupContext) => {
        if (context === FixupContext.Load) {
          if (requiresTrailingP(tr.selection)) {
            insertTrailingP(tr);
          }
        }
        return tr;
      },
    ];
  },

  appendTransaction: () => {
    return [
      {
        name: 'trailing_p',
        append: (tr: Transaction) => {
          if (requiresTrailingP(tr.selection)) {
            insertTrailingP(tr);
          }
          return tr;
        },
      },
    ];
  },
};

export default extension;
