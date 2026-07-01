/*
 * find.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { DecorationSet } from "prosemirror-view";

export interface EditorFind {
  decorations():  DecorationSet | null;
}
