/*
 * jsonrpc.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import jayson, { JSONRPCCallbackTypePlain, RequestParamsLike } from 'jayson'

import { asJsonRpcError, JsonRpcServerMethod } from 'core';

export function jaysonServerMethods(methods: Record<string,JsonRpcServerMethod>) {
  const jaysonMethods: Record<string,jayson.Method> = {};
  Object.keys(methods).forEach(method => {
    jaysonMethods[method] = jsonRpcMethod(methods[method]);
  });
  return jaysonMethods;
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
          done(asJsonRpcError(error));
        });
    }
  })
}

