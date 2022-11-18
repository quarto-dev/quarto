/*
 * json-rpc.ts
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

import jayson from 'jayson'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonRpcMethod(method: (args: Array<any>) => Promise<unknown>) : jayson.Method {
  return jayson.Method({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any, done: any) => {
      method(args)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((result: unknown) => done(null, result))
        .catch(error => {
          done({code: jayson.Server.errors.INTERNAL_ERROR, message: error.message});
        });
    },
    params: Array
  })
}
