/*
 * jsonrp.ts
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


import { jsonRpcError } from 'core';
import jayson, { JSONRPCCallbackTypePlain, RequestParamsLike } from 'jayson'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonRpcMethod(method: (params: any) => Promise<unknown>) : jayson.Method {
  return jayson.Method({
    handler: (args: RequestParamsLike, done: JSONRPCCallbackTypePlain) => {
      method(args)
        .then((result: unknown) => {
          done(null, result)
        })
        .catch(error => {
          if (typeof(error) === "object" && error.message) {
            done(jsonRpcError(error.message, error.data, error.code));
          } else {
            const message = error instanceof Error ? error.message : String(error);
            const jsonRpcErr = jsonRpcError(message);
            done(jsonRpcErr);
          }
        });
    }
  })
}

