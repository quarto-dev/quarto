/*
 * source.ts
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


import { ZoteroCollection, ZoteroCollectionSource, ZoteroCollectionSpec, ZoteroResult } from "editor-types";
import { zoteroDataDir } from "./datadir";
import { withZoteroDb } from "./db";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function zoteroLocalCollectionSource(dataDir?: string) : ZoteroCollectionSource {
 
  // resolve data dir
  dataDir = zoteroDataDir(dataDir);
  
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getCollections(collections: string[], cached: ZoteroCollectionSpec[]) : Promise<ZoteroResult> {
      if (dataDir) {
        try {
           // get collections
          const collections = await withZoteroDb<ZoteroCollection[]>(dataDir, async () => {
            return [];
          });

          // return result
          return {
            status: 'ok',
            message: collections,
            warning: '',
            error: ''
          }
        } catch(error) {
          console.error(error);
          return handleZoteroError(error);
        }
      } else {
        return zoteroResultEmpty();
      }
    },

    async getLibraryNames(): Promise<ZoteroResult> {
      try {  
        return {
          status: "ok",
          message: [],
          warning: '',
          error: ''
        }
      } catch(error) {
        return handleZoteroError(error);
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getActiveCollectionSpecs(collections: string[]): Promise<ZoteroResult> {
      try { 
        return {
          status: 'ok',
          message: [],
          warning: '',
          error: ''
        }
      } catch(error) {
        return handleZoteroError(error)
      }
    }
  };
}

function handleZoteroError(error: unknown) : ZoteroResult {
  return {
    status: 'error',
    message: null,
    warning: '',
    error: error instanceof Error ? error.message : JSON.stringify(error)
  }
}

function zoteroResultEmpty(message = []) : ZoteroResult {
  return {
    status: 'ok',
    message,
    warning: '',
    error: ''
  }
}