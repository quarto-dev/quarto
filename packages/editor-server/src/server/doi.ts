/*
 * doi.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { JsonRpcServerMethod } from "core";
import { DOIResult, DOIServer, kDoiFetchCsl } from "editor-types"

import { handleResponseWithStatus } from "./response";


const kDOIHost = "https://doi.org";
const kCSLJsonFormat = "application/vnd.citationstyles.csl+json";

export function doiServer() : DOIServer {
  return {
    async fetchCSL(doi: string) : Promise<DOIResult> {
      const url = `${kDOIHost}/${doi}`;
      return handleResponseWithStatus(async () => {
        const response = await fetch(url, { headers: { Accept: kCSLJsonFormat } });

        // some registration agencies don't support CSL content negotiation;
        // for those DOIs the request just redirects to the (HTML) landing
        // page, so report that rather than failing to parse the page as JSON
        const contentType = response.headers.get("Content-Type") || "";
        if (response.ok && !contentType.includes("json")) {
          throw new Error(
            "This DOI was found, but no citation data is available for it. " +
            "This usually means the organization that registered the DOI does not support automatic citation lookup. " +
            "To cite this work, you can add an entry to your bibliography manually."
          );
        }

        return response;
      });
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


