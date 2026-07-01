/*
 * user.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorUIContext } from "./ui-types";

export function currentUsername(ui: EditorUIContext) {
  return ui.getUsername ? ui.getUsername() : 'norah.jones';
}