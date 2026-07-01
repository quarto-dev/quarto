/*
 * find.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { DecorationSet } from "prosemirror-view";

export interface EditorFind {
  decorations():  DecorationSet | null;
}
