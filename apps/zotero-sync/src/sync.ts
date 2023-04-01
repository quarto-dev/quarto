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


import { zoteroApi } from "./api";
import { groupsLocal, groupsSync, groupsSyncActions, writeGroupMetadata } from "./groups";
import { syncLibraries } from "./libraries";
import { assignUserWebCollectionsDir, provisionUserWebCollectionsDir, userWebCollectionsDir } from "./storage";
import { zoteroTrace } from "./trace";

export interface SyncAction<T> {
  action: "update" | "add" | "delete";
  data: T
}

export async function syncWebCollections(userKey: string) {

  // start
  try {
    zoteroTrace("Beginning library sync")
    const zotero = zoteroApi(userKey);

    // user
    const user = await zotero.user();
    zoteroTrace(`Syncing user ${user.username} (id: ${user.userID})`);

    // groups
    const groups = groupsLocal(user);
    const groupsActions = await groupsSyncActions(user, groups, zotero);
    
    // if there are sync actions then provision a new dir for the user
    if (groupsActions.length > 0) {
      const newCollectionDir = provisionUserWebCollectionsDir(user);
      
      writeGroupMetadata(newCollectionDir, groupsSync(groups, groupsActions));

      // final atomic assign
      assignUserWebCollectionsDir(user, newCollectionDir);
    }
  
    // end
    zoteroTrace("Library sync complete")
  } catch(error) {
    zoteroTrace("Error occurred during sync:");
    console.error(error);
  }
}
