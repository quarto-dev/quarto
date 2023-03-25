/// <reference types="node" />/


import { setInterval } from "timers";

console.log("here we go again!");


// ensure that the deno runtime won't exit b/c of the event queue being empty
setInterval(() => { /* */ }, 1000);

