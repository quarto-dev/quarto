/*
* web-worker.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { workerCallback } from "./web-worker-manager.js";

import { getCompletions, getLint } from "./yaml-intelligence.js";

declare var onmessage: any;

onmessage = workerCallback({
  getCompletions,
  getLint,
});
