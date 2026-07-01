/*
 * crossref.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import fetch from "cross-fetch";

import { JsonRpcServerMethod } from "core";
import { CrossrefMessage, CrossrefServer, CrossrefWork, kCrossrefWorks, kStatusOK } from "editor-types";

import { handleResponseWithStatus } from "./response";

const kCrossrefApiHost = "https://api.crossref.org";
const kCrossrefWorksApi = "works";

export interface CrossrefServerOptions {
  userAgent: string;
  email: string;
}

export function crossrefServer(options: CrossrefServerOptions) : CrossrefServer {
  return {
    async works(query: string) : Promise<CrossrefMessage<CrossrefWork>> {
      const userAgent = `${options.userAgent}; ${options.userAgent} Crossref Cite (mailto: ${options.email})`;
      const url = `${kCrossrefApiHost}/${kCrossrefWorksApi}?` + new URLSearchParams({ query });
      const worksQuery = () => fetch(url, {
        headers: {
          "User-Agent": userAgent
        }
      });
      const result = await handleResponseWithStatus<CrossrefApiResponse>(worksQuery);
      if (result.status === kStatusOK) { 
        if (result.message?.status === "ok") {
          return result.message.message!;
        // non-OK status
        } else {
          throw new Error(`Error status from Crossref API: ${result.message?.status}`);
        }
       // non-OK status
      } else {
        throw new Error(`Crossref API Error: ${result.error}`);
      }
    }
  };
}

export function crossrefServerMethods(options: CrossrefServerOptions) : Record<string, JsonRpcServerMethod> {
  const server = crossrefServer(options);
  const methods: Record<string, JsonRpcServerMethod> = {
    [kCrossrefWorks]: args => server.works(args[0])
  };
  return methods;
}

interface CrossrefApiResponse {
  status: string;
  message?: CrossrefMessage<CrossrefWork>;
}
