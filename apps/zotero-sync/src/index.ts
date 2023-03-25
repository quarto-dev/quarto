/// <reference types="node" />/


import { setInterval } from "timers";
import { zoteroApi } from "./api";

const dump = (obj: unknown) => {
  console.log(JSON.stringify(obj, undefined, 2))
}

const zotero = zoteroApi("ZL68OPrdYJdKknDdlytHMcQc");

zotero.userInfo().then(dump);

zotero.groupVersions().then(dump);

zotero.group(2226282).then(dump)


// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

