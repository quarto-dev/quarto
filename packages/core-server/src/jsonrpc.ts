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


import jayson, { JSONRPCCallbackTypePlain, JSONRPCError, RequestParamsLike } from 'jayson'

export class JSONRPCServerError implements JSONRPCError {
  constructor(message: string, data?: string | object, code?: number) {
    this.code = code || -3200;
    this.message = message;
    if (typeof(data) === "string") {
      this.data = { description: data };
    } else if (typeof(data) === "object") {
      this.data = data;
    }
  }
  public readonly code;
  public readonly message;
  public readonly data?: object | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonRpcMethod(method: (params: any) => Promise<unknown>) : jayson.Method {
  return jayson.Method({
    handler: (args: RequestParamsLike, done: JSONRPCCallbackTypePlain) => {
      method(args)
        .then((result: unknown) => {
          done(null, result)
        })
        .catch(error => {
          if (error instanceof JSONRPCServerError) {
            done(error);
          } else {
            const message = error instanceof Error ? error.message : String(error);
            const jsonRpcErr = new JSONRPCServerError(message);
            done(jsonRpcErr);
          }
        });
    }
  })
}

