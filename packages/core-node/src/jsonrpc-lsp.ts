/*
 * lsp.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { asJsonRpcError, JsonRpcRequestTransport, JsonRpcServerMethod } from "core";

import { LanguageClient} from "vscode-languageclient/node";


export interface LspConnection {
  onRequest: (method: string, handler: (params: unknown[]) => Promise<unknown>) => void;
}

export function registerLspServerMethods(
  connection: LspConnection,
  methods: Record<string,JsonRpcServerMethod>
) {
  Object.keys(methods).forEach(methodName => {
    const method = methods[methodName];
    connection.onRequest(methodName, async (params: unknown[]) => {
      return method(params)
        .catch(error => {
          // our specific jsonrpc error code and data field are going to get lost 
          // by the request handling supervisor so we pack the data (if any)
          // into the message. note that 'data' with just a string uses a 
          // 'description' field by convention which we take advantage of here
          const jrpcError = asJsonRpcError(error);
          const message = jrpcError.message + 
            (jrpcError.data
              ? typeof(jrpcError.data?.description) === "string"
                ? ` (${jrpcError.data?.description})`
                : ` (${JSON.stringify(jrpcError.data)})`
              : "");
          return Promise.reject(new Error(message));
        })
    });
  });
}

export function lspClientTransport(client: LanguageClient) : JsonRpcRequestTransport {
  return async (method: string, params: unknown[] | undefined) : Promise<unknown> => {
    return client.sendRequest<{ result?: unknown, error?: Error }>(method, params)
      .catch(error => {
        return Promise.reject(asJsonRpcError(error));
      })
  };
}


