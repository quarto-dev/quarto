/*
 * input.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */


export function focusInput(input: HTMLInputElement | HTMLSelectElement | null) {
  if (input) {
    if (input.type === 'text') {
      (input as HTMLInputElement).setSelectionRange(0, 0);
    }
    input.focus();
  }
}


