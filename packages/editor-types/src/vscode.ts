/*
 * vscode-editor.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { EditorDisplay } from "./display";

export const VSC_VE_Init = 'vsc_ve_init';
export const VSC_VE_GetMarkdown = 'vsc_ve_get_markdown';
export const VSC_VE_GetMarkdownFromState = 'vsc_ve_get_markdown_from_state';
export const VSC_VE_ApplyExternalEdit = 'vsc_ve_apply_external_edit';

export const VSC_VEH_GetHostContext = 'vsc_ve_get_host_context';
export const VSC_VEH_ReopenSourceMode = 'vsc_ve_reopen_source_mode';
export const VSC_VEH_OnEditorReady = 'vsc_veh_on_editor_ready';
export const VSC_VEH_OnEditorUpdated = 'vsc_veh_on_editor_updated';
export const VSC_VEH_FlushEditorUpdates = 'vsc_veh_flush_editor_updates';
export const VSC_VEH_EditorResourceUri = 'vsc_veh_editor_resource_url';

export const VSC_VEH_OpenURL = 'vsc_veh_open_url';
export const VSC_VEH_NavigateToXRef = 'vsc_veh_navigate_to_xref';
export const VSC_VEH_NavigateToFile = 'vsc_veh_navigate_to_file';

export interface VSCodeVisualEditor {
  init: (markdown: string) => Promise<string>; 
  getMarkdownFromState: (state: unknown) => Promise<string>;
  applyExternalEdit: (markdown: string) => Promise<void>;
}

export interface HostContext {
  documentPath: string | null;
  resourceDir: string;
  isWindowsDesktop: boolean;
}

export interface VSCodeVisualEditorHost extends EditorDisplay {
  getHostContext: () => Promise<HostContext>;
  reopenSourceMode: () => Promise<void>;
  onEditorReady: () => Promise<void>; 
  onEditorUpdated: (state: unknown) => Promise<void>;
  flushEditorUpdates: () => Promise<void>;
  editorResourceUri: (path: string) => Promise<string>;
}



