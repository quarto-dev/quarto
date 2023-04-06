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

import { CSL, ZoteroCSL, ZoteroCollection, ZoteroCollectionSource, ZoteroCollectionSpec, ZoteroResult, kZoteroMyLibrary } from "editor-types"
import { Item, Library, User, ZoteroApi, ZoteroAuthorizationError, ZoteroObjectNotFoundError, ZoteroServiceUnavailable } from "./api";
import { groupsLocal } from "./groups";
import { libraryList } from "./libraries";
import { libraryRead, libraryReadCollections, libraryReadVersions, userWebLibrariesDir } from "./storage";


export function webCollectionSource(zotero: ZoteroApi) : ZoteroCollectionSource {
  return {
    async getCollections(collections: string[], cached: ZoteroCollectionSpec[]) : Promise<ZoteroResult> {
      
      try {
        const libraries = await collectionNamesToLibraries(zotero.user, collections);
        const zoteroCollections: ZoteroCollection[] = [];
        for (const library of libraries) {
          const versions = await libraryReadVersions(zotero.user, library);
          const cachedSpec = cached.find(spec => spec.key === String(library.id));
          if (cachedSpec?.version === versions.items) {
            zoteroCollections.push({...cachedSpec, items: []});
          } else {
            const libraryData = libraryRead(userWebLibrariesDir(zotero.user), library);
            zoteroCollections.push({
              name: library.type === "user" ? kZoteroMyLibrary : (libraryData.group?.name || "(Untitled)"),
              version: libraryData.versions.items,
              key: String(library.id),
              parentKey: "",
              items: asCollectionSourceItems(library, libraryData.items)
            })
          }
        }
        return {
          status: 'ok',
          message: zoteroCollections,
          warning: '',
          error: ''
        }
      } catch(error) {
        return handleZoteroError(error);
      }
      
    },

    async getLibraryNames(): Promise<ZoteroResult> {
      try {
        const names = (await localLibraries(zotero.user)).map(libraryName);
        return {
          status: "ok",
          message: names,
          warning: '',
          error: ''
        }
      } catch(error) {
        return handleZoteroError(error);
      }
       
    },

    async getActiveCollectionSpecs(collections: string[]): Promise<ZoteroResult> {

      try { 
        const libraries = collections.length === 0 
          ? await localLibraries(zotero.user)
          : await collectionNamesToLibraries(zotero.user, collections);
        const collectionSpecs: ZoteroCollectionSpec[] = [];
        for (const library of libraries) {
          const versions = await libraryReadVersions(zotero.user, library);
          // read main library
          collectionSpecs.push({
            name: library.type === "user" ? kZoteroMyLibrary : library.group?.name || "(Untitled)",
            version: versions.items,
            key: String(library.id),
            parentKey: ""
          });
          // read collections
          const collections = await libraryReadCollections(zotero.user, library);
          for (const collection of collections) {
            collectionSpecs.push({
              name: collection.name,
              version: collection.version,
              key: collection.key,
              parentKey: typeof(collection.parentCollection) === "string" 
                ? collection.parentCollection 
                : String(library.id)
            });
          }
        }
        return {
          status: 'ok',
          message: collectionSpecs,
          warning: '',
          error: ''
        }
      } catch(error) {
        return handleZoteroError(error)
      }
    }
  };
}

async function localLibraries(user: User) {
  const groups = await groupsLocal(user);
  return libraryList(user, groups);
}

function libraryName(library: Library) {
  return library.type === "user" ? kZoteroMyLibrary : (library.group?.name || "(Untitled)");
}

async function collectionNamesToLibraries(user: User, collections: string[]) {
  const allLibraries = await localLibraries(user);
  return allLibraries.filter(library => {
    return collections.includes(libraryName(library));
  });
}

function asCollectionSourceItems(library: Library, items: Item[]) : ZoteroCSL[] {
  return items.map(item => {
    const collectionKeys: string[] = [String(library.id)];
    if (item.data?.["collections"]) {
      collectionKeys.push(...((item.data["collections"] as unknown[]).map(String)));
    }
    return {
      libraryID: String(library.id),
      collectionKeys,
      ...cslJsonFromItem(item),
    }
  })
}


function cslJsonFromItem(item: Item) {

  // The ids generated by Web Zotero are pretty rough, so just strip them
  // and allow the caller to generate an id if they'd like
  const csljson: CSL = { ...item.csljson, id: "" };
 
  const dataExtra = item.data["extra"];
  if (typeof(dataExtra) === "string") {
    resolveCslJsonCheaterKey(csljson, dataExtra);
  }
  const cslNote = csljson["note"];
  if (typeof(cslNote) === "string") {
    resolveCslJsonCheaterKey(csljson, cslNote);
  }

  return csljson;
}

const kKeyPattern = /((.*?)\s*:\s*([^\s]+))/g;

function resolveCslJsonCheaterKey(csl: CSL, cheaterValue: string) {
  kKeyPattern.lastIndex = 0;
  let match = kKeyPattern.exec(cheaterValue);
  while (match !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) {
      csl[cheaterKey(key)] = value;
    }
    match = kKeyPattern.exec(cheaterValue);
  }  
  kKeyPattern.lastIndex = 0;
}

function cheaterKey(cslKey: string) {
  if (cslKey === "Citation Key") {
    return "id";
  } else {
    return cslKey;
  }
}

function handleZoteroError(error: unknown) : ZoteroResult {
  if (error instanceof ZoteroAuthorizationError || error instanceof ZoteroObjectNotFoundError) {
    return {
      status: 'notfound',
      message: null,
      warning: '',
      error: error.message
    }
  } else if (error instanceof ZoteroServiceUnavailable) {
    return {
      status: "nohost",
      message: null,
      warning: "",
      error: error.message
    }
  } else {
    return {
      status: "error",
      message: null,
      warning: '',
      error: error instanceof Error ? error.message : JSON.stringify(error),
    }
  }
}