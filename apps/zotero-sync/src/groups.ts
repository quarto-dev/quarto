/*
 * groups.ts
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

import * as fs from "fs";
import path from "path";
import { Group, User, ZoteroApi } from "./api";
import { userWebCollectionsDir } from "./storage";
import { SyncAction } from "./sync";
import { zoteroTrace } from "./trace";

export function groupsLocal(user: User) : Group[] {
  const groupsFile = readGroupMetadata(user);
  if (fs.existsSync(groupsFile)) {
   return JSON.parse(fs.readFileSync(groupsFile, { encoding: "utf8"})) as Group[];
  } else {
   return [];
  }
}

export async function groupsSyncActions(user: User, groups: Group[], zotero: ZoteroApi) {
  
  // sync actions
  const actions: SyncAction<Group>[] = [];

  // get existing group metadata
  zoteroTrace("Syncing groups")
  const serverGroupVersions = await zotero.groupVersions(user.userID);
  const serverGroupIds = Object.keys(serverGroupVersions).map(Number);

  // remove groups
  const removeGroups = groups.filter(group => !serverGroupIds.includes(group.id));
  for (const group of removeGroups) {
    traceGroupAction("Removing", group);
    actions.push( { action: "delete", data: group });
  }
  
  // update/add groups
  for (const serverGroupId of serverGroupIds) {
    const localGroup = groups.find(group => group.id === serverGroupId);
    if (!localGroup || (localGroup.version !== serverGroupVersions[localGroup.id])) {
      const serverGroup = await zotero.group(serverGroupId, localGroup?.version || 0);
      if (serverGroup) { 
        if (localGroup) {
          if (serverGroup.version !== localGroup.version) {
            traceGroupAction("Updating", serverGroup.data);
            actions.push({ action: "update", data: serverGroup.data });
          }
        } else {
          const newGroup = serverGroup.data;
          traceGroupAction("Adding", newGroup);
          actions.push({ action: "add", data: newGroup });
        }
      }
    }
  } 

  // return the sync actions
  return actions;
}

export function groupsSync(groups: Group[], actions: SyncAction<Group>[]) {
  let newGroups = [...groups];
  for (const action of actions) {
    switch(action.action) {
      case "add":
        newGroups.push(action.data);
        break;
      case "update":
      case "delete":
        newGroups = newGroups.filter(group => group.id !== action.data.id);
        if (action.action === "update") {
          newGroups.push(action.data);
        }
        break;
    }
  }
  return newGroups;
}


export function writeGroupMetadata(collectionsDir: string, groups: Group[]) {
  const groupsFile = path.join(collectionsDir, kGroupsFile);
  fs.writeFileSync(groupsFile, JSON.stringify(groups, undefined, 2));
}

const kGroupsFile = "groups.json";

function readGroupMetadata(user: User) {
  return path.join(userWebCollectionsDir(user), kGroupsFile);
}

function traceGroupAction(action: string, group: Group) {
  zoteroTrace(`${action} group ${group.name} (id: ${group.id}, version ${group.version})`);
}

