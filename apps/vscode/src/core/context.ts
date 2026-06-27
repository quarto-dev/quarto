/*
 * context.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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

import { Uri } from "vscode";
import { commands } from "vscode";

type ContextKeyScalar = null | undefined | boolean | number | string | Uri;

type ContextKeyValue =
  | ContextKeyScalar
  | Array<ContextKeyScalar>
  | Record<string, ContextKeyScalar>;

export class ContextKey<T extends ContextKeyValue = boolean> {
  private _value?: T;

  constructor(public readonly name: string) { }

  public get(): T | undefined {
    return this._value;
  }

  public async set(value: T): Promise<void> {
    this._value = value;
    await commands.executeCommand('setContext', this.name, this._value);
  }

  public async reset() {
    await commands.executeCommand('setContext', this.name, undefined);
  }
}
