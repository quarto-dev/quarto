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

import { Collection, Group, Item, Library, User } from "./api";
import { SyncAction } from "./sync";

// this is how we transform zotero rest api requests into ZoteroCollection
// https://github.com/rstudio/rstudio/blob/main/src/cpp/session/modules/zotero/ZoteroCollectionsWeb.cpp#L240

// TODO: need to delete libraries when groups are deleted

export interface LibrarySyncActions {
  library: Library;
  collection: SyncAction<Collection>[];
  item: SyncAction<Item>[];
}

export interface LibraryCollections{
  collections: Collection[];
  items: Item[];
}

export function libraryList(user: User, groups: Group[]) : Library[] {
  return [{ type: "user", id: user.userID } as Library]
            .concat(groups.map(group => ({ type: "group", id: group.id })));
}


export async function librarySyncActions(_user: User, library: Library) : Promise<LibrarySyncActions> {

  const actions: LibrarySyncActions = { library, collection: [], item: [] };

  // read existing collection and item version lists (if any)
  // see if there are any changes
  // query for deletes

  return actions;

}

export function librarySync(user: User, actions: LibrarySyncActions) : LibraryCollections {

  const collections: LibraryCollections = { collections: [], items: [] };

  // read existing collection and item data (if any)

  // apply actions and return new collections

  return collections;


}

export function libraryWriteCollections(collectionsDir: string, library: Library, collections: LibraryCollections) {
  // write version lists
  // write actual data
}

export function libraryCopy(_user: User, library: Library, fromDir: string, toDir: string) {
  const libraryDir = `${library.type}-${library.id}`;
  const libraryFrom = path.join(fromDir, libraryDir);
  const libraryTo = path.join(toDir, libraryDir);
  fs.cpSync(libraryFrom, libraryTo, { recursive: true });
}

export function hasLibrarySyncActions(sync: LibrarySyncActions) {
  return sync.collection.length > 0 || sync.item.length > 0;
}


