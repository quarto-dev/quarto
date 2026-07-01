/*
 * display.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorMenuItem } from "./menu";
import { XRef } from "./xref";

export interface EditorDisplay {
  openURL: (url: string) => void;
  navigateToXRef: (file: string, xref: XRef) => void;
  navigateToFile: (file: string) => void;
  showContextMenu?: (items: EditorMenuItem[], clientX: number, clientY: number) => Promise<boolean>;
}


