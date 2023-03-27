/// <reference types="node" />/


import { setInterval } from "timers";
import { zoteroApi } from "./api";

const dump = (obj: unknown) => {
  console.log(JSON.stringify(obj, undefined, 2))
}

// https://github.com/retorquere/zotero-sync/blob/main/index.ts

// see rate limiting and caching: https://www.zotero.org/support/dev/web_api/v3/basics


const zotero = zoteroApi("ZL68OPrdYJdKknDdlytHMcQc");


zotero.user().then(async (user) => {
  dump(user);
  /*
  dump(await zotero.groupVersions());

  dump(await zotero.group(2226282));

  const collections = await zotero.collectionVersions(0);
  dump(collections);
  dump(await zotero.collections(Object.keys(collections.data)));
  */

  const items = await zotero.itemVersions(0);
  dump(items);
  dump(await zotero.items(Object.keys(items.data)));
});




// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

