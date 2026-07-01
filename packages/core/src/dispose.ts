/*
 * dispose.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

export interface IDisposable {
  dispose(): void;
}

export class MultiDisposeError extends Error {
  constructor(
    public readonly errors: unknown[]
  ) {
    super(`Encountered errors while disposing of store. Errors: [${errors.join(', ')}]`);
  }
}

export function disposeAll(disposables: Iterable<IDisposable>) {
  const errors: unknown[] = [];

  for (const disposable of disposables) {
    try {
      disposable.dispose();
    } catch (e) {
      errors.push(e);
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  } else if (errors.length > 1) {
    throw new MultiDisposeError(errors);
  }
}

export interface IDisposable {
  dispose(): void;
}

export abstract class Disposable {
  #isDisposed = false;

  protected _disposables: IDisposable[] = [];

  public dispose() {
    if (this.#isDisposed) {
      return;
    }
    this.#isDisposed = true;
    disposeAll(this._disposables);
  }

  protected _register<T extends IDisposable>(value: T): T {
    if (this.#isDisposed) {
      value.dispose();
    } else {
      this._disposables.push(value);
    }
    return value;
  }

  protected get isDisposed() {
    return this.#isDisposed;
  }
}

export class DisposableStore extends Disposable {
  readonly #items = new Set<IDisposable>();

  public override dispose() {
    super.dispose();
    this.clear();
  }

  public add<T extends IDisposable>(item: T): T {
    if (this.isDisposed) {
      console.warn('Adding to disposed store. Item will be leaked');
    }

    this.#items.add(item);
    return item;
  }

  /**
   * Dispose of all registered disposables but do not mark this object as disposed.
   */
  public clear(): void {
    if (this.#items.size === 0) {
      return;
    }

    try {
      disposeAll(this.#items);
    } finally {
      this.#items.clear();
    }
  }
}
