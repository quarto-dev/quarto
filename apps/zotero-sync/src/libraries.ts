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
import { SyncAction } from "./sync";

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
  actions: {
    collections: SyncAction<Collection>[],
    items: SyncAction<Item>[]
  }
}



export function libraryList(user: User, groups: Group[]) : Library[] {
  return [{ type: "user", id: user.userID } as Library]
            .concat(groups.map(group => ({ type: "group", id: group.id })));
}


export async function librarySyncActions(user: User, library: Library, zotero: ZoteroApi) : Promise<LibrarySyncActions> {

  // actions we will return
  const syncActions: LibrarySyncActions = { 
    versions: { collections: 0, items: 0, deleted: 0 }, 
    actions: { collections: [], items: [] } 
  };

  // get library version numbers already synced to
  const versions = libraryVersions(user, library);

  // check for deletes
  const deleted = await zotero.deleted(library, versions.deleted);
  if (deleted) {
    syncActions.versions.deleted = deleted.version || syncActions.versions.deleted;
    for (const deletedCollection of deleted.data.collections) {

    }
    for (const deletedItem of deleted.data.items) {

    }
  }

  // check for collections
  const collectionChanges = await zotero.collectionVersions(library, versions.collections);
  if (collectionChanges) {
    // update version
    syncActions.versions.collections = collectionChanges.version || syncActions.versions.collections;
    // process changes

  }

  // check for items
  const itemChanges = await zotero.itemVersions(library, versions.items);
  if (itemChanges) {
    // update version
    syncActions.versions.items = itemChanges?.version || syncActions.versions.items;
    // process changes
  }


  return syncActions;
}

export function librarySync(user: User, library: Library, syncActions: LibrarySyncActions) : LibraryObjects {

  // read collections and apply actions
  const dir = libraryDir(user, library);
  const collectionsFile = libraryCollectionsFile(dir);
  let collections: Collection[] = fs.existsSync(collectionsFile) 
    ? JSON.parse(fs.readFileSync(collectionsFile, { encoding: "utf-8" }))
    : [];
  for (const action of syncActions.actions.collections) {
    switch(action.action) {
      case "add":
        collections.push(action.data);
        break;
      case "update":
      case "delete":
        collections = collections.filter(collection => collection.key !== action.data.key);
        if (action.action === "update") {
          collections.push(action.data);
        }
        break;
    }
  }

  // read items and apply actions
  const itemsFile = libraryItemsFile(dir);
  let items: Item[] = fs.existsSync(itemsFile)
    ? JSON.parse(fs.readFileSync(itemsFile, { encoding: "utf-8" }))
    : [];
  for (const action of syncActions.actions.items) {
    switch(action.action) {
      case "add":
        items.push(action.data);
        break;
      case "update":
      case "delete":
        items = items.filter(item => item.key !== action.data.key);
        if (action.action === "update") {
          items.push(action.data);
        }
        break;
    }
  }
  
  // return objects
  return { 
    versions: syncActions.versions,
    collections,
    items
  };
}

export function libraryWriteObjects(collectionsDir: string, library: Library, objects: LibraryObjects) {
  // write versions
  libraryWriteVersions(collectionsDir, objects.versions)
  
  // write collections
  fs.writeFileSync(
    libraryCollectionsFile(collectionsDir),
    JSON.stringify(objects.collections, undefined, 2),
    { encoding: "utf-8" } 
  );

  // write items
  fs.writeFileSync(
    libraryItemsFile(collectionsDir),
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
  return sync.actions.collections.length > 0 || sync.actions.items.length > 0;
}

function libraryVersions(user: User, library: Library) : LibraryVersions {
  const versionsFile = libraryVersionsFile(libraryDir(user, library));
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

function libraryWriteVersions(collectionsDir: string, versions: LibraryVersions) {
  const versionsFile = libraryVersionsFile(collectionsDir);
  fs.writeFileSync(versionsFile, JSON.stringify(versions, undefined, 2));
}


function libraryVersionsFile(collectionsDir: string) {
  return path.join(collectionsDir, "versions.json");
}

function libraryCollectionsFile(collectionsDir: string) {
  return path.join(collectionsDir, "collections.json");
}

function libraryItemsFile(collectionsDir: string) {
  return path.join(collectionsDir, "items.json");
}

function libraryDir(user: User, library: Library) {
  const collectionsDir = userWebCollectionsDir(user);
  return path.join(collectionsDir, libraryDirName(library));
}

function libraryDirName(library: Library) {
  return `${library.type}-${library.id}`;
}


