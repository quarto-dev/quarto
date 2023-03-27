/// <reference types="node" />/
/*
 * index.ts
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

import { setInterval } from "timers";
import { Library, zoteroApi } from "./api";

const dump = (obj: unknown) => {
  console.log(JSON.stringify(obj, undefined, 2))
}

// https://github.com/retorquere/zotero-sync/blob/main/index.ts

// see rate limiting and caching: https://www.zotero.org/support/dev/web_api/v3/basics


const zotero = zoteroApi("ZL68OPrdYJdKknDdlytHMcQc");


zotero.user().then(async (user) => {
  //dump(user);

  /*
  dump(await zotero.groupVersions(user.userID));
  dump(await zotero.group(2226282));
  */

  /*
  const groupLibrary: Library = { type: "group", id: 2558114 };
  const userLibrary: Library = { type: "user", id: user.userID };
  */
 
  /*
  const collections = await zotero.collectionVersions(groupLibrary, 3);
  dump(collections);
  dump(await zotero.collections(groupLibrary, ["57YSFW7C"], 3));
  */

  /*
  const items = await zotero.itemVersions(userLibrary, 0);
  dump(items);
  if (items) {
    dump(await zotero.items(userLibrary, Object.keys(items.data).slice(0, 1), 154));
  }
  */
});




// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

