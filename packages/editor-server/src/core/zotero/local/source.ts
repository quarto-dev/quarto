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

import { Database } from "node-sqlite3-wasm";

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
          const collections = await withZoteroDb<ZoteroCollection[]>(dataDir, async (db: Database) => {
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
      if (dataDir) {
        try {  
          const libraries = await withZoteroDb<string[]>(dataDir, async (db: Database) => {
            return getCollections(db)
              .filter(collection => !collection.parentKey)
              .map(collection => collection.name)
          });
          return {
            status: "ok",
            message: libraries,
            warning: '',
            error: ''
          }
        } catch(error) {
          return handleZoteroError(error);
        }
      } else {
        return zoteroResultEmpty();
      }
      
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getActiveCollectionSpecs(collections: string[]): Promise<ZoteroResult> {
      if (dataDir) {

        try {  
          const specs = await withZoteroDb<ZoteroCollectionSpec[]>(dataDir, async (db: Database) => {
            
            // get all collections
            const allCollections = getCollections(db);
            
            // find the parent of a given collection
            const findParentSpec = (spec: ZoteroCollectionSpec) => {
              if (spec.parentKey.length > 0) {
                return allCollections.find(coll => coll.key === spec.parentKey);
              } else {
                return undefined;
              }
            }

            // filter on the passed collections if need be
            if (collections.length > 0) {

              return allCollections.filter(spec => {
                // find the top-level library of the spec (when the loop terminates
                // the targetSpec will be the library spec)
                let targetSpec = spec;
                for (;;)
                {
                  const parentSpec = findParentSpec(targetSpec);
                  if (!parentSpec) {
                    break;
                  } else {
                    targetSpec = parentSpec;
                  }
                }

                // see if that library is in the list of passed collections
                return collections.includes(targetSpec.name);
              })
            } else {
              return allCollections;
            }
          });

          return {
            status: "ok",
            message: specs,
            warning: '',
            error: ''
          }
        } catch(error) {
          return handleZoteroError(error);
        }
      } else {
        return zoteroResultEmpty();
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

function getCollections(db: Database, librariesOnly = false) : ZoteroCollectionSpec[] {

  const librariesSql = `
    SELECT
        CAST(libraries.libraryID as text) as collectionKey,
        IFNULL(groups.name, 'My Library') as collectionName,
        NULL as parentCollectionKey,
        IFNULL(strftime('%s', MAX(MAX(items.clientDateModified), MAX(collections.clientDateModified))), '0') AS version,
        libraries.version as dbVersion
    FROM
        libraries
        left join items on libraries.libraryID = items.libraryID
        left join collections on libraries.libraryID = collections.libraryID
        join itemTypes on items.itemTypeID = itemTypes.itemTypeID
        left join deletedItems on items.itemId = deletedItems.itemID
        left join groups as groups on libraries.libraryID = groups.libraryID
    WHERE
        libraries.type in ('user', 'group')
    AND
        itemTypes.typeName <> 'attachment'
    AND
        itemTypes.typeName <> 'note'
    AND
        deletedItems.dateDeleted IS NULL
    GROUP
        BY libraries.libraryID
  `.trim();

  const collectionsSql = `
    SELECT
        collections.key as collectionKey,
        collections.collectionName as collectionName,
        IFNULL(parentCollections.key, libraries.libraryId) as parentCollectionKey,
        IFNULL(strftime('%s', MAX(MAX(items.clientDateModified), MAX(collections.clientDateModified))), '0') AS version,
        collections.version as dbVersion
    FROM
        collections
        join libraries on libraries.libraryID = collections.libraryID
        left join collectionItems on collections.collectionID = collectionItems.collectionID
        left join items on collectionItems.itemID = items.itemID
        left join itemTypes on items.itemTypeID = itemTypes.itemTypeID
        left join collections as parentCollections on collections.parentCollectionID = parentCollections.collectionID
        left join groups as groups on libraries.libraryID = groups.libraryID
    GROUP BY
        collections.key
  `.trim();

  // If this is libraries only, just read the libraries, otherwise union the library and collection SQL
  const sql = librariesOnly ? librariesSql : `${librariesSql} UNION ${collectionsSql}`;
  return (db.all(sql) as Array<Record<string,string>>).map(row => {
    const version = parseFloat(row["version"]) || parseFloat(row["dbVersion"]) || 0;
    return {
      name: String(row["collectionName"]),
      version,
      key: String(row["collectionKey"] || "-1"),
      parentKey: String(row["parentCollectionKey"] || "")
    }
  });  
}
