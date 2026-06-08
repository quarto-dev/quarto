/*
 * api.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import * as vscode from "vscode";

import { QuartoContext } from "quarto-core";

/**
 * Payload for the {@link QuartoExtensionApi.onDidChangeVisualEditorSelection} event.
 */
export interface VisualEditorSelection {
  /** The document whose visual editor selection changed. */
  uri: vscode.Uri;
  /** The currently selected text (empty string when nothing is selected). */
  selectedText: string;
}

/**
 * Public API for the Quarto extension.
 *
 * Other extensions can access this API to get information about the Quarto CLI
 * that the Quarto extension is using. This is useful when you need to know
 * the exact Quarto binary path, including when Quarto is bundled in Positron
 * or installed in a Python virtual environment.
 *
 * ## Usage from another extension
 *
 * Since your extension cannot import types from the Quarto extension directly,
 * copy this interface definition into your own codebase:
 *
 * ```typescript
 * // Copy these definitions into your extension
 * interface VisualEditorSelection {
 *   uri: vscode.Uri;
 *   selectedText: string;
 * }
 * interface QuartoExtensionApi {
 *   getQuartoPath(): string | undefined;
 *   getQuartoVersion(): string | undefined;
 *   isQuartoAvailable(): boolean;
 *   onDidChangeVisualEditorSelection: vscode.Event<VisualEditorSelection>;
 * }
 *
 * // Then use it like this:
 * async function getQuartoPathFromExtension(): Promise<string | undefined> {
 *   const quartoExt = vscode.extensions.getExtension('quarto.quarto');
 *   if (!quartoExt) {
 *     return undefined;
 *   }
 *   if (!quartoExt.isActive) {
 *     await quartoExt.activate();
 *   }
 *   const api = quartoExt.exports as QuartoExtensionApi;
 *   return api.getQuartoPath();
 * }
 * ```
 */
export interface QuartoExtensionApi {
  /**
   * Get the path to the Quarto CLI binary that the extension is using.
   * Returns undefined if Quarto is not available.
   */
  getQuartoPath(): string | undefined;

  /**
   * Get the version of Quarto that the extension is using.
   * Returns undefined if Quarto is not available.
   */
  getQuartoVersion(): string | undefined;

  /**
   * Check if Quarto is available.
   */
  isQuartoAvailable(): boolean;

  /**
   * Fires when the text selection changes in a Quarto visual editor.
   *
   * The event carries the document URI and the currently selected text. An
   * empty `selectedText` is a meaningful event (e.g. the selection was cleared),
   * so consumers can use it to reset their UI. Events are de-duplicated against
   * the previous selection for a given document, but not time-debounced — the
   * underlying editor reports state changes on every cursor move, so consumers
   * that need throttling should debounce themselves.
   */
  onDidChangeVisualEditorSelection: vscode.Event<VisualEditorSelection>;
}

/**
 * Create the public API for the Quarto extension.
 */
export function createQuartoExtensionApi(
  quartoContext: QuartoContext,
  onDidChangeVisualEditorSelection: vscode.Event<VisualEditorSelection>
): QuartoExtensionApi {
  return {
    getQuartoPath(): string | undefined {
      if (!quartoContext.available) {
        return undefined;
      }
      return quartoContext.binPath;
    },

    getQuartoVersion(): string | undefined {
      if (!quartoContext.available) {
        return undefined;
      }
      return quartoContext.version;
    },

    isQuartoAvailable(): boolean {
      return quartoContext.available;
    },

    onDidChangeVisualEditorSelection,
  };
}
