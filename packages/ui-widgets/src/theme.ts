/*
 * theme.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export const kDarkThemeClass = 'bp4-dark';

export function setDarkThemeActive(active: boolean) {
  const root = document.getElementById('root');
  if (root) {
    if (active) {
      root.classList.add(kDarkThemeClass);  
    } else {
      root.classList.remove(kDarkThemeClass);
    }
  }
}

export function isDarkThemeActive() {
  return document.getElementById('root')?.classList.contains(kDarkThemeClass);
}
