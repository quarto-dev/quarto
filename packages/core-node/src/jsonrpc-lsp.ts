/*
 * lsp.ts
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


import { asJsonRpcError, JsonRpcRequestTransport, JsonRpcServerMethod } from "core";

import { Connection, ResponseError } from "vscode-languageserver/node";

import { LanguageClient} from "vscode-languageclient/node";

export function registerLspServerMethods(
  connection: Connection, 
  methods: Record<string,JsonRpcServerMethod>
) {
  Object.keys(methods).forEach(methodName => {
    const method = methods[methodName];
    connection.onRequest(methodName, (params) => {
      method(params)
        .then(value => {
          return Promise.resolve(value);
        })
        .catch(error => {
          return Promise.reject(asResponseError(error));
        })
    });
  });
}

export function lspClientTransport(client: LanguageClient) : JsonRpcRequestTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (method: string, params: unknown[] | undefined) : Promise<any> => {
    return client.sendRequest(method, params)
      .catch(error => {
        return Promise.reject(asJsonRpcError(error));
      })
  };
}


function asResponseError(error: unknown) {
  const jrpcError = asJsonRpcError(error);
  return new ResponseError(jrpcError.code, jrpcError.message, jrpcError.data);
}

