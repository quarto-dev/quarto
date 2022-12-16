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

import { JsonRpcServerMethod } from "core";
import { kZoteroBetterBibtexExport, kZoteroGetActiveCollectionSpecs, kZoteroGetCollections, kZoteroGetLibraryNames, kZoteroValidateWebApiKey, ZoteroCollectionSpec, ZoteroResult, ZoteroServer } from "editor-types";

export function zoteroServer(): ZoteroServer {
  return {
    validateWebAPIKey(key: string): Promise<boolean> {
      throw new Error("not supported");
    },

    async getCollections(
      file: string | null,
      collections: string[],
      cached: ZoteroCollectionSpec[],
      useCache: boolean
    ): Promise<ZoteroResult> {
      return {
        status: 'ok',
        message: [],
        warning: '',
        error: ''
      }
    },

    getLibraryNames(): Promise<ZoteroResult> {
      throw new Error("not supported");
    },

    async getActiveCollectionSpecs(
      file: string | null,
      collections: string[]
    ): Promise<ZoteroResult> {
      return {
        status: 'ok',
        message: [],
        warning: '',
        error: ''
      }
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

export function zoteroServerMethods() : Record<string, JsonRpcServerMethod> {
  const server = zoteroServer();
  const methods: Record<string, JsonRpcServerMethod> = {
    [kZoteroValidateWebApiKey]: args => server.validateWebAPIKey(args[0]),
    [kZoteroGetCollections]: args => server.getCollections(args[0], args[1], args[2], args[3]),
    [kZoteroGetLibraryNames]: () => server.getLibraryNames(),
    [kZoteroGetActiveCollectionSpecs]: args => server.getActiveCollectionSpecs(args[0], args[1]),
    [kZoteroBetterBibtexExport]: args => server.betterBibtexExport(args[0], args[1], args[2])
  }
  return methods;
}
