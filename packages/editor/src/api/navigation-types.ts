/*
 * navigation-types.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export interface EditorNavigation {
  navigate: (type: NavigationType, location: string, animate?: boolean) => void;
}

export enum NavigationType {
  Pos = 'pos',
  Id = 'id',
  Href = 'href',
  Heading = 'heading',
  XRef = 'xref'
}

export interface Navigation {
  pos: number;
  prevPos: number;
}

