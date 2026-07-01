/*
 * tooltip.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import tlite from 'tlite';

import './tooltip.css';

export function showTooltip(
  el: Element,
  text: string,
  grav: 's' | 'n' | 'e' | 'w' | 'sw' | 'se' | 'nw' | 'ne' = 'n',
  timeout = 2000,
) {
  el.setAttribute('title', '');
  el.setAttribute('data-tlite', text);
  tlite.show(el, { grav });
  setTimeout(() => tlite.hide(el), timeout);
}
