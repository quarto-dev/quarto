/*
 * server.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { jsonRpcBrowserClient } from "core";
import { kUserGetPrefs, kUserGetState, kUserSetPrefs, kUserSetState, UserPrefs, UserState, WriterServer } from "writer-types";


export function writerJsonRpcServer(url: string) : WriterServer {

  const request = jsonRpcBrowserClient(url);

  return {
    user: {
      getPrefs() : Promise<UserPrefs> {
        return request(kUserGetPrefs, []);
      },
      setPrefs(prefs: UserPrefs) : Promise<void> {
        return request(kUserSetPrefs, [prefs]);
      },
      getState() : Promise<UserState> {
        return request(kUserGetState, []);
      },
      setState(state: UserState) : Promise<void> {
        return request(kUserSetState, [state]);
      }
    }
  }
}