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
import { webCollectionsDir, zoteroTrace } from "./utils";

export async function syncGroups(zotero: ZoteroApi, user: User) {
  
  // get existing group metadata
  zoteroTrace("Syncing groups")
  let localGroups = readGroupMetadata(user.userID);
  const serverGroupVersions = await zotero.groupVersions(user.userID);
  const serverGroupIds = Object.keys(serverGroupVersions).map(Number);

  // remove groups
  const removeGroups = localGroups.filter(group => !serverGroupIds.includes(group.id));
  for (const group of removeGroups) {
    traceGroupAction("Removing", group);
    localGroups = localGroups.filter(localGroup => localGroup.id !== group.id);
  }
  
  // update/add groups
  for (const serverGroupId of serverGroupIds) {
    const serverGroup = await zotero.group(serverGroupId);
    if (serverGroup) {
      const localGroup = localGroups.find(group => group.id === serverGroup.data.id);
      if (localGroup) {
        if (serverGroup.version !== localGroup.version) {
          traceGroupAction("Updating", serverGroup.data);
          Object.assign(localGroup, serverGroup.data);
        }
      } else {
        const newGroup = serverGroup.data;
        traceGroupAction("Adding", newGroup);
        localGroups.push(newGroup);
      }
    }
  } 

  // save groups
  writeGroupMetadata(user.userID, localGroups);

  // return the groups
  return localGroups;
}


function traceGroupAction(action: string, group: Group) {
  zoteroTrace(`${action} group ${group.name} (id: ${group.id}, version ${group.version})`);
}

function readGroupMetadata(userId: number) : Group[] {
   const groupsFile = groupMetadataFile(userId);
   if (fs.existsSync(groupsFile)) {
    return JSON.parse(fs.readFileSync(groupsFile, { encoding: "utf8"})) as Group[];
   } else {
    return [];
   }
}

function writeGroupMetadata(userId: number, groups: Group[]) {
  const groupsFile = groupMetadataFile(userId);
  fs.writeFileSync(groupsFile, JSON.stringify(groups, undefined, 2));
}

function groupMetadataFile(userId: number) {
  return path.join(webCollectionsDir(userId), "groups.json");
}
