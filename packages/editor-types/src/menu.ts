/*
 * menu.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


export interface EditorMenus {
  format: EditorMenuItem[];
  insert: EditorMenuItem[];
  table: EditorMenuItem[];
}

export interface EditorMenuItem {
  text?: string;
  exec?: VoidFunction;
  command?: string;
  separator?: boolean;
  subMenu?: {
    items: EditorMenuItem[];
  };
}


