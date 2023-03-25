/// <reference types="node" />/




import { readFileSync } from "fs";


// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);


