/*
 * cancellation.ts
 *
 * Copyright (C) 2023-2026 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { CancellationToken, Emitter } from 'vscode-languageserver';

export const noopToken: CancellationToken = new class implements CancellationToken {
  readonly #onCancellationRequestedEmitter = new Emitter<void>();
  onCancellationRequested = this.#onCancellationRequestedEmitter.event;

  get isCancellationRequested() { return false; }
}();
