/*
 * user.ts
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

import jayson from "jayson";

import { jsonRpcMethod } from "core-server";

import { UserPrefs, kUserGetPrefs, kUserSetPrefs, UserState, kUserGetState, kUserSetState, UserServer } from "writer-types";

export function userServer() : UserServer {
 
  let userPrefs : UserPrefs = {
    dictionaryLocale: 'en-US'
  };
  let userState : UserState = {
    showMarkdown: false,
    showOutline: false
  }

  return {
    async getPrefs() : Promise<UserPrefs> {
      return userPrefs;
    },
    async setPrefs(updatedPrefs: UserPrefs) : Promise<void> {
      userPrefs = updatedPrefs;
    },
    async getState(): Promise<UserState> {
      return userState;
    },
    async setState(updatedState: UserState) : Promise<void> {
      userState = updatedState;
    }
  }

}

export function userServerMethods() : Record<string, jayson.Method> {
  const server = userServer();
  const methods: Record<string, jayson.Method> = {
    [kUserGetPrefs]: jsonRpcMethod(() => server.getPrefs()),
    [kUserSetPrefs]: jsonRpcMethod((prefs) => server.setPrefs(prefs)),
    [kUserGetState]: jsonRpcMethod(() => server.getState()),
    [kUserSetState]: jsonRpcMethod((state) => server.setState(state))
  };
  return methods;
}