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

export const kUserGetPrefs = "user_get_prefs";
export const kUserSetPrefs = "user_set_prefs";
export const kUserGetState = "user_get_state";
export const kUserSetState = "user_set_state";

export interface UserPrefs {
  readonly dictionaryLocale: string;
}

export interface UserState {
  readonly showOutline: boolean;
  readonly showMarkdown: boolean;
}

export interface UserServer {
  getPrefs: () => Promise<UserPrefs>;
  setPrefs: (prefs: UserPrefs) => Promise<void>;
  getState: () => Promise<UserState>;
  setState: (prefs: UserState) => Promise<void>;
}