/*
 * toolbar.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { CancellationToken, TextDocument, ProviderResult } from "vscode";

export interface ToolbarCommand {
  commandId: string;
  title: string;
  enabled: boolean;
  codeicon?: string;
  text?: string;
}

export interface ToolbarButton extends ToolbarCommand {
  splitMenu?: ToolbarMenu;
}

export interface ToolbarMenu {
  title: string;
  codeicon?: string;
  text?: string;
  items: ToolbarItem[];
}

export type ToolbarItem = ToolbarButton | ToolbarMenu | "---";

export type EditorToolbarProvider = (document: TextDocument, token: CancellationToken) => ProviderResult<ToolbarItem[]>;
