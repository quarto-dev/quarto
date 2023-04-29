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

/*
ZoteroCollectionSpecs getCollections(boost::shared_ptr<database::IConnection> pConnection, bool librariesOnly = false)
{
   std::string librariesSql = R"(
                              SELECT
                                  CAST(libraries.libraryID as text) as collectionKey,
                                  IFNULL(groups.name, 'My Library') as collectionName,
                                  NULL as parentCollectionKey,
                                  IFNULL(strftime('%s', MAX(MAX(items.clientDateModified), MAX(collections.clientDateModified))), '0') AS version
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
                          )";

   std::string collectionsSql = R"(
                                SELECT
                                    collections.key as collectionKey,
                                    collections.collectionName as collectionName,
                                    IFNULL(parentCollections.key, libraries.libraryId) as parentCollectionKey,
                                    IFNULL(strftime('%s', MAX(MAX(items.clientDateModified), MAX(collections.clientDateModified))), '0') AS version
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
                            )";

    // If this is libraries only, just read the libraries, otherwise
    // union the library and collection SQL
    std::string sql = librariesSql;
    if (!librariesOnly) {
        sql = boost::str(boost::format("%1% UNION %2%") % librariesSql % collectionsSql);
    }

   ZoteroCollectionSpecs specs;
   Error error = execQuery(pConnection, sql, [&specs](const database::Row& row) {

      // had this issue: https://github.com/rstudio/rstudio/issues/8861
      // perhaps a corrupted collection or a collection using an older
      // schema that was unversioned?
      try
      {
         ZoteroCollectionSpec spec;
         spec.name = row.get<std::string>("collectionName");
         spec.key = readString(row, "collectionKey", "-1");

         std::string versionStr = readString(row, "version", "0");
         spec.version = safe_convert::stringTo<double>(versionStr, 0);

         const soci::indicator indicator = row.get_indicator("parentCollectionKey");
         if (indicator == soci::i_ok)
         {
            // If the parent key is not null, this is a child collection
            spec.parentKey = row.get<std::string>("parentCollectionKey");
         }
         specs.push_back(spec);
      }
      CATCH_UNEXPECTED_EXCEPTION
   });

   if (error)
      LOG_ERROR(error);

   return specs;
}
*/