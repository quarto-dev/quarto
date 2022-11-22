/*
 * jsonrpc.ts
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


import ClientBrowser from "jayson/lib/client/browser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonRpcBrowserClient(url: string) : (method: string, params: any[]) => Promise<any> {

  const callServer = (
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
    fetch(url, options)
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        callback(null, text);
      })
      .catch(function (err) {
        callback(err);
      });
  };

  const client = new ClientBrowser(callServer, {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return  (method: string, params: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Promise<any>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.request(method, params, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else if (result.error) {
          reject(new Error(result.error.message));
        } else { 
          resolve(result.result);
        }
      });
    });
  };
}