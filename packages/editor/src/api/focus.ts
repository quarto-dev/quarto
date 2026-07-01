/*
 * focus.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export function isElementFocused(element: HTMLElement | null): boolean {
  if (element) {
    return window.document.activeElement === element;
  }
  return false;
}

export function focusElement(element: HTMLElement | null) {
  if (element) {
    element.focus();
  }
}
