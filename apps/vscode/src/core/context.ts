/*
 * context.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
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
