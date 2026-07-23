/*
 * doi.ts
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


