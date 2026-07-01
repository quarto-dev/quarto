/*
 * browser.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import ClientBrowser from "jayson/lib/client/browser";

import { jsonRpcError, JsonRpcRequestTransport } from "core";

export function jsonRpcBrowserRequestTransport(url: string) : JsonRpcRequestTransport {

  const createClient = (method: string) => {
    return new ClientBrowser(
      (
        request: string,
        callback: (err?: Error | null, response?: string) => void
      ) => {
        const options = {
          method: "POST",
          body: request,
          headers: {
            "Content-Type": "application/json",
          },
        };
        fetch(`${url}/${method}`, options)
          .then(function (res) {
            if (res.ok) {
              return res.text();
            } else {
              return Promise.reject(new Error(res.status + " error"));
            }
          })
          .then(function (text) {
            callback(null, text);
          })
          .catch(function (err) {
            callback(err);
          });
      },
      {}
    )
  }


  return  (method: string, params: unknown[] | undefined) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<any>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createClient(method).request(method, params, (err: any, result: any) => {
        if (err) {
          if (typeof(err) === "object" && err.message) {
            reject(jsonRpcError(err.message, err.data, err.code));
          } else {
            reject(jsonRpcError(String(err)));
          }
        } else if (result?.error) {
          reject(result?.error);
        } else if (result) { 
          resolve(result.result);
        } else {
          reject(jsonRpcError("Unknown error"));
        }
      });
    });
  };
}