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

import { Group, Library, User, ZoteroApi } from "./api";

// this is how we transform zotero rest api requests into ZoteroCollection
// https://github.com/rstudio/rstudio/blob/main/src/cpp/session/modules/zotero/ZoteroCollectionsWeb.cpp#L240


export async function syncLibraries(user: User, groups: Group[], zotero: ZoteroApi) {
  const libraries: Library[] = [{ type: "user", id: user.userID } as Library]
    .concat(groups.map(group => ({ type: "group", id: group.id })));
  for (const library of libraries) {
    await syncLibrary(user, library, zotero);
  }
}

export async function syncLibrary(user: User, library: Library, zotero: ZoteroApi) {
  
  console.log(library);
  //
}