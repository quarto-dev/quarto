/*
 * prefs.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import path from "node:path";
import fs from "node:fs";

import { JsonRpcServerMethod } from "core";
import { appConfigDir } from "core-node";

import { Prefs, kPrefsGetPrefs, kPrefsSetPrefs, PrefsServer, defaultPrefs } from "editor-types";


const prefsDir = appConfigDir("quarto-writer", "prefs");
const prefsFile = path.join(prefsDir, "prefs.json");


export function prefsServer() : PrefsServer {
 
  return {

    async getPrefs() : Promise<Prefs> {
      let prefs = defaultPrefs();
      if (fs.existsSync(prefsFile)) {
        const prefsJSON = fs.readFileSync(prefsFile, { encoding: "utf-8" });
        prefs = { ...prefs, ...JSON.parse(prefsJSON )}
      }
      return prefs;
    },

    async setPrefs(prefs: Prefs) : Promise<void> {
      const prefsUpdated = prefs as unknown as Record<string,unknown>;
      const prefsDefault = defaultPrefs() as unknown as Record<string,undefined>;
      const prefsDiff: Record<string,unknown> = {};
      Object.keys(prefsUpdated).forEach(pref => {
        if (prefsUpdated[pref] !== prefsDefault[pref]) {
          prefsDiff[pref] = prefsUpdated[pref];
        }
      });
      const diffJSON = JSON.stringify(prefsDiff, undefined, 2);
      fs.writeFileSync(prefsFile, diffJSON, { encoding: "utf-8" });
    }
  }
}

export function prefsServerMethods(server: PrefsServer) : Record<string, JsonRpcServerMethod> {
  const methods: Record<string, JsonRpcServerMethod> = {
    [kPrefsGetPrefs]: () => server.getPrefs(),
    [kPrefsSetPrefs]: (prefs) => server.setPrefs(prefs[0])
  };
  return methods;
}