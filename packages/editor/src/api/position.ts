/*
 * position.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { ResolvedPos } from 'prosemirror-model';

export function isOnlyChild(pos: ResolvedPos, depthOffset = 1) {
  return pos.node(pos.depth - depthOffset).childCount === 1;
}

export function isLastChild(pos: ResolvedPos, depthOffset = 1) {
  return pos.index(pos.depth - depthOffset) === pos.node(pos.depth - depthOffset).childCount - 1;
}
