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

export interface PrefsProvider {
  prefs() : Prefs;
  setPrefs(prefs: Record<keyof Prefs,unknown>) : void;
}

export interface Prefs {
  // view
  readonly showOutline: boolean;

  // theme
  readonly darkMode: boolean;

  // spelling
  readonly realtimeSpelling: boolean;
  readonly dictionaryLocale: string;

  // editing
  readonly emojiSkinTone: number;
  readonly listSpacing: 'tight' | 'spaced';
  readonly tabKeyMoveFocus: boolean;
  readonly equationPreview: boolean;

  // citations
  readonly zoteroUseBetterBibtex: boolean;
  readonly bibliographyDefaultType: 'bib' | 'yaml' | 'json';
  readonly citationDefaultInText: boolean;
  readonly packageListingEnabled: boolean;

  // code editing (vscode settings)
  readonly spacesForTab: boolean;
  readonly tabWidth: number;
  readonly autoClosingBrackets: boolean;   // done
  readonly highlightSelectedWord: boolean;
  readonly showWhitespace: boolean;
  readonly blinkingCursor: boolean;

  // code editing (native settings)
  readonly lineNumbers: boolean;
}

export function defaultPrefs() : Prefs {
  return {
    // view
    showOutline: false,

    // theme
    darkMode: false,

    // spelling
    realtimeSpelling: true,
    dictionaryLocale: 'en_US',

    // editing
    emojiSkinTone: 0,
    listSpacing: 'spaced',
    tabKeyMoveFocus: false,
    equationPreview: true,

    // citations
    zoteroUseBetterBibtex: false,
    bibliographyDefaultType: 'bib',
    citationDefaultInText: false,
    packageListingEnabled: false,

    // code editing
    spacesForTab: true,
    tabWidth: 2,
    autoClosingBrackets: true,
    highlightSelectedWord: true,
    lineNumbers: true,
    showWhitespace: false,
    blinkingCursor: true
  }
}

export interface PrefsServer {
  getPrefs: () => Promise<Prefs>;
  setPrefs: (prefs: Prefs) => Promise<void>;
}