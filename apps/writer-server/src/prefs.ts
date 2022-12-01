/*
 * prefs.ts
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

import { Prefs, kPrefsGetPrefs, kPrefsSetPrefs, PrefsServer, defaultPrefs } from "writer-types";



export function prefsServer() : PrefsServer {
 
  let prefs = defaultPrefs();

  return {
    async getPrefs() : Promise<Prefs> {
      return prefs;
    },
    async setPrefs(updatedPrefs: Prefs) : Promise<void> {
      prefs = updatedPrefs;
    }
  }

}

export function prefsServerMethods() : Record<string, jayson.Method> {
  const server = prefsServer();
  const methods: Record<string, jayson.Method> = {
    [kPrefsGetPrefs]: jsonRpcMethod(() => server.getPrefs()),
    [kPrefsSetPrefs]: jsonRpcMethod((prefs) => server.setPrefs(prefs[0]))
  };
  return methods;
}