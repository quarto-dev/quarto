/*
 * extension.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Transaction } from 'prosemirror-state';

export enum FixupContext {
  Load,
  Save,
  Resize,
}

export type FixupFn = (tr: Transaction, fixupContext: FixupContext) => Transaction;
