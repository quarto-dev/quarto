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

export const kPrefsGetPrefs = "prefs_get_prefs";
export const kPrefsSetPrefs = "prefs_set_prefs";

export interface Prefs {
  readonly showOutline: boolean;
  readonly showMarkdown: boolean;
  readonly dictionaryLocale: string;
}

export function defaultPrefs() : Prefs {
  return {
    showMarkdown: false,
    showOutline: false,
    dictionaryLocale: 'en-US'
  }
}

export interface PrefsServer {
  getPrefs: () => Promise<Prefs>;
  setPrefs: (prefs: Prefs) => Promise<void>;
}