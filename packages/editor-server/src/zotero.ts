/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * zotero.ts
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

import { ZoteroCollectionSpec, ZoteroResult, ZoteroServer } from "editor-types";

export function zoteroServer(): ZoteroServer {
  return {
    validateWebAPIKey(key: string): Promise<boolean> {
      throw new Error("not supported");
    },

    getCollections(
      file: string | null,
      collections: string[],
      cached: ZoteroCollectionSpec[],
      useCache: boolean
    ): Promise<ZoteroResult> {
      throw new Error("not supported");
    },

    getLibraryNames(): Promise<ZoteroResult> {
      throw new Error("not supported");
    },

    getActiveCollectionSpecs(
      file: string | null,
      collections: string[]
    ): Promise<ZoteroResult> {
      throw new Error("not supported");
    },

    // Return status: nohost w/ warning text if it fails to
    // communciate w/ Better BibTeX. Otherwise returns
    // status: ok with exported text in message.
    betterBibtexExport(
      itemKeys: string[],
      translatorId: string,
      libraryId: number
    ): Promise<ZoteroResult> {
      throw new Error("not supported");
    },
  };
}
