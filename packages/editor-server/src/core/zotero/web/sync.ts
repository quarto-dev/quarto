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


import { Group, Library, ZoteroApi, ZoteroObjectNotFoundError } from "./api";
import { groupDelete, groupLocal, groupsLocal, groupsSync, groupsSyncActions } from "./groups";
import { hasLibrarySyncActions, libraryList, librarySync, librarySyncActions, LibrarySyncActions } from "./libraries";
import { libraryWrite, userWebLibrariesDir } from "./storage";
import { zoteroTrace } from "./trace";

export interface SyncActions<T> {
  deleted: string[];
  updated: T[];
}

export async function syncLibrary(
  zotero: ZoteroApi, 
  type: "user" | "group", 
  id: number
) {
  
  // alias user
  const user = zotero.user;

  // status
  zoteroTrace(`Syncing library (${type}-${id})`);

  // see if we need to update group info
  const library: Library = { type, id };
  let groupSync: Group | null = null;
  if (type === "group") {

    // fill in local group data
    library.group = await groupLocal(user, id) || undefined;

    // get latest version of group from server 
    try {
     
      const serverGroup = await zotero.group(id, library.group?.version || 0);
      
      // update if we got back a server group that is differnent from the local group
      if (serverGroup && serverGroup.version !== library.group?.version) {
        groupSync = serverGroup.data;
      }
    } catch(error) {
      // if it no longer exists then remove it
      if (error instanceof ZoteroObjectNotFoundError) {
        zoteroTrace(`Removing library (${type}-${id})`);
        groupDelete(user, id);
        return;
      }
    }
  }

  // check for library sync actions
  const syncActions = await librarySyncActions(zotero, library, groupSync);
  if (hasLibrarySyncActions(syncActions)) {
    const objects = librarySync(user, library, syncActions);
    libraryWrite(userWebLibrariesDir(user), library, objects);
  } 

  zoteroTrace("Sync complete");
}


export async function syncAllLibraries(zotero: ZoteroApi) {

  // start
  try {
    zoteroTrace("Beginning sync")

    // alias user then sync
    const user = zotero.user;
    zoteroTrace(`Syncing user ${user.username} (id: ${user.userID})`);

    // read current groups and deduce group actions
    const groups = await groupsLocal(user);
    const groupsActions = await groupsSyncActions(zotero, groups);

    // remove deleted groups
    for (const groupId of groupsActions.deleted) {
      zoteroTrace(`Removing group ${groupId}`);
      groupDelete(user, Number(groupId));
    }

    // determine updated groups
    const updatedGroups = groupsSync(groups, groupsActions);

    // compute libraries and sync actions for libraries
    const libraries = libraryList(user, updatedGroups);
    const librariesSync: Array<{ library: Library, actions: LibrarySyncActions }> = [];
    for (const library of libraries) {
      zoteroTrace(`Syncing library (${library.type}-${library.id})`);
      const groupSync = groupsActions.updated.find((group: Group) => group.id === library.id) || null;
      librariesSync.push({ 
        library, 
        actions: (await librarySyncActions(zotero, library, groupSync))
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
