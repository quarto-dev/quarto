/*
 * libraries.ts
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

import fs from "fs";
import path from "path";

import { Collection, Group, Item, Library, User, ZoteroApi } from "./api";
import { userWebCollectionsDir } from "./storage";
import { SyncActions } from "./sync";
import { zoteroTrace } from "./trace";

// this is how we transform zotero rest api requests into ZoteroCollection
// https://github.com/rstudio/rstudio/blob/main/src/cpp/session/modules/zotero/ZoteroCollectionsWeb.cpp#L240


export interface LibraryObjects {
  versions: LibraryVersions;
  collections: Collection[];
  items: Item[];
}

export interface LibraryVersions {
  collections: number;
  items: number;
  deleted: number;
}

export interface LibrarySyncActions {
  versions: LibraryVersions;
  collections: SyncActions<Collection>,
  items: SyncActions<Item>
}



export function libraryList(user: User, groups: Group[]) : Library[] {
  return [{ type: "user", id: user.userID } as Library]
            .concat(groups.map(group => ({ type: "group", id: group.id })));
}


export async function librarySyncActions(user: User, library: Library, zotero: ZoteroApi) : Promise<LibrarySyncActions> {

  // actions we will return
  const syncActions: LibrarySyncActions = { 
    versions: { 
      collections: 0, 
      items: 0, 
      deleted: 0 
    }, 
    collections: { 
      deleted: [], 
      updated: []
    },
    items: {
      deleted: [], 
      updated: []
    }
  };

  // get library version numbers already synced to
  const versions = libraryVersions(user, library);

  // check for deletes
  const deleted = await zotero.deleted(library, versions.deleted);
  if (deleted) {

    // update version
    syncActions.versions.deleted = deleted.version || syncActions.versions.deleted;
    
    // process deleted collections
    for (const deletedCollection of deleted.data.collections) {
      traceAction("Removing", "collection", `(key: ${deletedCollection}`);
      syncActions.collections.deleted.push(deletedCollection);
    }
    
    // process deleted items
    for (const deletedItem of deleted.data.items) {
      traceAction("Removing", "item", `key: ${deletedItem}`);
      syncActions.items.deleted.push(deletedItem);
    }
  }

  // check for collections
  const collectionChanges = await zotero.collectionVersions(library, versions.collections);
  if (collectionChanges) {
    // process changes
    const collections = await zotero.collections(library, Object.keys(collectionChanges.data));
    for (const collection of collections) {
      traceAction("Updating", "collection", `${collection.name} - ${collection.key}`)
      syncActions.collections.updated.push(collection);
    }
    // update version
    syncActions.versions.collections = collectionChanges.version || syncActions.versions.collections;
  }

  // check for items
  const itemChanges = await zotero.itemVersions(library, versions.items);
  if (itemChanges) {
    // process changes
    const items = await zotero.items(library, Object.keys(itemChanges.data));
    for (const item of items) {
      traceAction("Updating", "item", `${item.csljson.title || "Untitled"} - ${item.key}`);
      syncActions.items.updated.push(item);
    }
    // update version
    syncActions.versions.items = itemChanges?.version || syncActions.versions.items;
  }

  return syncActions;
}


export function librarySync(user: User, library: Library, syncActions: LibrarySyncActions) : LibraryObjects {

  // read collections and apply actions
  const dir = userWebCollectionsDir(user);
  const collectionsFile = libraryCollectionsFile(dir, library);
  const localCollections: Collection[] = fs.existsSync(collectionsFile) 
    ? JSON.parse(fs.readFileSync(collectionsFile, { encoding: "utf-8" }))
    : [];
  const collections = syncObjects(localCollections, syncActions.collections);

  // read items and apply actions
  const itemsFile = libraryItemsFile(dir, library);
  const localItems: Item[] = fs.existsSync(itemsFile)
    ? JSON.parse(fs.readFileSync(itemsFile, { encoding: "utf-8" }))
    : [];
  const items = syncObjects(localItems, syncActions.items);
  
  // return objects
  return { 
    versions: syncActions.versions,
    collections,
    items
  };
}

export function libraryWriteObjects(collectionsDir: string, library: Library, objects: LibraryObjects) {
  // create dir
  const libraryDir = path.join(collectionsDir, libraryDirName(library));
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir);
  }
  
  // write versions
  libraryWriteVersions(collectionsDir, library, objects.versions)
  
  // write collections
  fs.writeFileSync(
    libraryCollectionsFile(collectionsDir, library),
    JSON.stringify(objects.collections, undefined, 2),
    { encoding: "utf-8" } 
  );

  // write items
  fs.writeFileSync(
    libraryItemsFile(collectionsDir, library),
    JSON.stringify(objects.items, undefined, 2),
    { encoding: "utf-8" } 
  );

}


export function libraryCopy(_user: User, library: Library, fromDir: string, toDir: string) {
  const libraryDir = libraryDirName(library);
  const libraryFrom = path.join(fromDir, libraryDir);
  const libraryTo = path.join(toDir, libraryDir);
  if (fs.existsSync(libraryFrom)) {
    fs.cpSync(libraryFrom, libraryTo, { recursive: true });
  }
}

export function hasLibrarySyncActions(sync: LibrarySyncActions) {
  return sync.collections.deleted.length > 0 ||
         sync.collections.updated.length > 0 ||
         sync.items.deleted.length > 0 ||
         sync.items.updated.length > 0;
}

function libraryVersions(user: User, library: Library) : LibraryVersions {
  const versionsFile = libraryVersionsFile(userWebCollectionsDir(user), library);
  if (fs.existsSync(versionsFile)) {
    return JSON.parse(fs.readFileSync(versionsFile, { encoding: "utf-8" })) as LibraryVersions;
  } else {
    return {
      deleted: 0,
      collections: 0,
      items: 0
    }
  }
}

function syncObjects<T extends { key: string }>(objects: T[], syncActions: SyncActions<T>) {

  // handle deletes
  objects = objects.filter(obj => !syncActions.deleted.includes(obj.key));

  // handle updates (remove then add)
  const updatedIds = syncActions.updated.map(obj => obj.key);
  objects = objects.filter(obj => !updatedIds.includes(obj.key));
  objects.push(...syncActions.updated);

  // return
  return objects;
}


function libraryWriteVersions(collectionsDir: string, library: Library, versions: LibraryVersions) {
  const versionsFile = libraryVersionsFile(collectionsDir, library);
  fs.writeFileSync(versionsFile, JSON.stringify(versions, undefined, 2));
}


function libraryVersionsFile(collectionsDir: string, library: Library) {
  return path.join(collectionsDir, libraryDirName(library), "versions.json");
}

function libraryCollectionsFile(collectionsDir: string, library: Library) {
  return path.join(collectionsDir, libraryDirName(library), "collections.json");
}

function libraryItemsFile(collectionsDir: string, library: Library) {
  return path.join(collectionsDir, libraryDirName(library), "items.json");
}

function libraryDirName(library: Library) {
  return `${library.type}-${library.id}`;
}

type ObjectType = "collection" | "item";

function traceAction(action: string, type: ObjectType, summary: string) {
  zoteroTrace(`${action} ${type} (${summary})`);
}



