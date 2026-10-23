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

interface Registration {
  disposable: Disposable;
  showCodeCellsInOutline: boolean;
}

// Re-registers the document symbol provider when the outline setting changes,
// so the client re-queries symbols. Updates for an unchanged setting are
// skipped, since the client's configuration-change and theme-change
// notifications fire for any setting.
export function documentSymbolRegistrar(
  register: (showCodeCellsInOutline: boolean) => Promise<Disposable>,
  onError: (error: unknown) => void
): DocumentSymbolRegistrar {
  // The registration as of the most recent update. Each update replaces this
  // synchronously, before awaiting, so it builds on the previous update rather
  // than racing it: two updates that both awaited the same registration would
  // both dispose it and the second would leak the first's replacement, which
  // shows up as a duplicate "Quarto" group in the outline (#1209).
  let current: Promise<Registration | undefined> = Promise.resolve(undefined);

  return {
    async update(showCodeCellsInOutline: boolean) {
      current = updateRegistration(current, showCodeCellsInOutline, register, onError);
      await current;
    }
  };
}

async function updateRegistration(
  previous: Promise<Registration | undefined>,
  showCodeCellsInOutline: boolean,
  register: (showCodeCellsInOutline: boolean) => Promise<Disposable>,
  onError: (error: unknown) => void
): Promise<Registration | undefined> {
  const registration = await previous;
  if (registration?.showCodeCellsInOutline === showCodeCellsInOutline) {
    return registration;
  }
  try {
    registration?.disposable.dispose();
    return {
      disposable: await register(showCodeCellsInOutline),
      showCodeCellsInOutline
    };
  } catch (error) {
    // Leave nothing registered so the next update retries.
    onError(error);
    return undefined;
  }
}
