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

import { QuartoContext } from "quarto-core";

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
 * // Copy this interface into your extension
 * interface QuartoExtensionApi {
 *   getQuartoPath(): string | undefined;
 *   getQuartoVersion(): string | undefined;
 *   isQuartoAvailable(): boolean;
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
}

/**
 * Create the public API for the Quarto extension.
 */
export function createQuartoExtensionApi(quartoContext: QuartoContext): QuartoExtensionApi {
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
  };
}
