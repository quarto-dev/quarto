/*
 * link.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export enum LinkType {
  URL = 0,
  Heading = 1,
  ID = 2,
}

export interface LinkCapabilities {
  headings: boolean;
  attributes: boolean;
  text: boolean;
}

export interface LinkTargets {
  readonly ids: string[];
  readonly headings: LinkHeadingTarget[];
}

export interface LinkHeadingTarget {
  readonly level: number;
  readonly text: string;
}


