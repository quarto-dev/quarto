/*
 * symbol-registration.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Disposable } from "vscode-languageserver";

export interface DocumentSymbolRegistrar {
  // Resolves once this update and all earlier ones have finished. Never
  // rejects; registration failures go to `onError`.
  update(showCodeCellsInOutline: boolean): Promise<void>;
}

// Updates run one at a time: if two overlapped, both would dispose the same
// old registration and the second assignment would leak the first new one,
// which shows up as a duplicate "Quarto" group in the outline (#1209).
// Updates for an unchanged outline setting are skipped, since the client's
// configuration-change and theme-change notifications fire for any setting.
export function documentSymbolRegistrar(
  register: (showCodeCellsInOutline: boolean) => Promise<Disposable>,
  onError: (error: unknown) => void
): DocumentSymbolRegistrar {
  let queue: Promise<void> = Promise.resolve();
  let registration: Disposable | undefined;
  let registeredFor: boolean | undefined;

  return {
    update(showCodeCellsInOutline: boolean) {
      queue = queue.then(async () => {
        if (registration && registeredFor === showCodeCellsInOutline) {
          return;
        }
        registration?.dispose();
        registration = undefined;
        registration = await register(showCodeCellsInOutline);
        registeredFor = showCodeCellsInOutline;
      }).catch(onError);
      return queue;
    }
  };
}
