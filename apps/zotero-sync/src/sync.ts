/*
 * sync.ts
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


import { Library, zoteroApi } from "./api";
import { groupsDelete, groupsLocal, groupsSync, groupsSyncActions } from "./groups";
import { hasLibrarySyncActions, libraryList, librarySync, librarySyncActions, LibrarySyncActions } from "./libraries";
import { libraryWrite, userWebLibrariesDir } from "./storage";
import { zoteroTrace } from "./trace";



// TODO: ability to do foreground sync (for initial config)

// TODO: if the API key doesn't work surface an error to the user 
// (and possibly allow reset of ID?)

// TODO: write code to go all the way through to sync a collection

// TODO: implement realtime API to optmize this

// this is how we transform zotero rest api requests into ZoteroCollection
// https://github.com/rstudio/rstudio/blob/main/src/cpp/session/modules/zotero/ZoteroCollectionsWeb.cpp#L240

export interface SyncActions<T> {
  deleted: string[];
  updated: T[];
}

export async function syncWebCollections(userKey: string) {

  // start
  try {
    zoteroTrace("Beginning sync")
    const zotero = zoteroApi(userKey);

    // user
    const user = await zotero.user();
    zoteroTrace(`Syncing user ${user.username} (id: ${user.userID})`);

    // read current groups and deduce group actions
    const groups = await groupsLocal(user);
    const groupsActions = await groupsSyncActions(user, groups, zotero);

    // remove deleted groups
    for (const groupId of groupsActions.deleted) {
      groupsDelete(user, Number(groupId));
    }

    // determine updated groups
    const updatedGroups = groupsSync(groups, groupsActions);

    // compute libraries and sync actions for libraries
    const libraries = libraryList(user, updatedGroups);
    const librariesSync: Array<{ library: Library, actions: LibrarySyncActions }> = [];
    for (const library of libraries) {
      const groupSync = groupsActions.updated.find(group => group.id === library.id) || null;
      librariesSync.push({ 
        library, 
        actions: (await librarySyncActions(user, library, groupSync, zotero))
      });
    }

    // write synced libraries
    const dir = userWebLibrariesDir(user);
    for (const sync of librariesSync) {
      if (hasLibrarySyncActions(sync.actions)) {
        const objects = librarySync(user, sync.library, sync.actions);
        libraryWrite(dir, sync.library, objects);
      } 
    }
  
    // end
    zoteroTrace("Sync complete")
  } catch(error) {
    zoteroTrace("Error occurred during sync:");
    console.error(error);
  }
}
