/*
 * crossref.ts
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

import { jsonRpcMethod } from "core-server";
import { CrossrefMessage, CrossrefServer, CrossrefWork, kCrossrefWorks } from "editor-types";

import jayson from 'jayson'


export function crossrefServer() : CrossrefServer {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    works(query: string) : Promise<CrossrefMessage<CrossrefWork>> {
      throw new Error("not implemented");
    }
  };
}

export function crossrefServerMethods() : Record<string, jayson.Method> {
  const server = crossrefServer();
  const methods: Record<string, jayson.Method> = {
    [kCrossrefWorks]: jsonRpcMethod(args => server.works(args[0]))
  };
  return methods;
}
