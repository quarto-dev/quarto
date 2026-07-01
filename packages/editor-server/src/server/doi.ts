/*
 * doi.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import fetch from "cross-fetch";

import { JsonRpcServerMethod } from "core";
import { DOIResult, DOIServer, kDoiFetchCsl } from "editor-types"

import { handleResponseWithStatus } from "./response";


const kDOIHost = "https://doi.org";
const kCSLJsonFormat = "application/vnd.citationstyles.csl+json";

export function doiServer() : DOIServer {
  return {
    async fetchCSL(doi: string) : Promise<DOIResult> {
      const url = `${kDOIHost}/${doi}`;
      return handleResponseWithStatus(
        () => fetch(url, { headers: { Accept: kCSLJsonFormat } })
      );
    }
  }
}

export function doiServerMethods() : Record<string, JsonRpcServerMethod> {
  const server = doiServer();
  const methods: Record<string, JsonRpcServerMethod> = {
    [kDoiFetchCsl]: args => server.fetchCSL(args[0])
  };
  return methods;
}


